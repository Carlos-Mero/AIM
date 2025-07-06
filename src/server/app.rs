use actix_web::{web, App, HttpResponse, HttpServer, Responder, HttpRequest};
use actix_files::Files;
use actix_cors::Cors;
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use sea_orm::{Database, DatabaseConnection, Statement, EntityTrait, QueryFilter, ColumnTrait, ActiveModelTrait, Set, ConnectionTrait, DbBackend};
use actix_web::web::Path;
use serde::{Serialize};
use crate::server::entity::user::{Entity as User, ActiveModel as UserActiveModel, Column as UserColumn};
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Header, Algorithm, Validation};
use crate::sessions::{ResearchSession, ResearchSessionConfig, Session};
use log::{info, error};
use serde::Deserialize;

/// JWT claims
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: i32,
    email: String,
    exp: usize,
}

pub async fn run() -> std::io::Result<()> {
    // Determine database path (env DATABASE_PATH or default "aim.db")
    let db_path = std::env::var("DATABASE_PATH").unwrap_or_else(|_| "aim.db".to_string());
    let db_path_buf = std::path::PathBuf::from(&db_path);
    println!("Using database path: {}", db_path_buf.display());
    if let Some(parent) = db_path_buf.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).expect("Failed to create database directory");
        }
    }
    let db_url = format!("sqlite://{}?mode=rwc", db_path);
    // Connect to SQLite via SeaORM
    let db: DatabaseConnection = Database::connect(&db_url).await
        .expect(&format!("Failed to connect to database: {}", db_url));
    // Initialize database schema if not exists (raw SQL)
    let create_tbl = r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            affiliation TEXT NOT NULL,
            specialization TEXT NOT NULL,
            invitation_code TEXT,
            created_at TEXT NOT NULL
        );
    "#;
    db.execute(Statement::from_string(DbBackend::Sqlite, create_tbl.to_owned()))
        .await
        .expect("Failed to create users table");
    // Ensure projects table exists (for listing projects)
    let create_projects = r#"
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            problem TEXT NOT NULL,
            context TEXT,
            config TEXT NOT NULL,
            memory TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_active TEXT NOT NULL,
            lemmas_count INTEGER NOT NULL
        );
    "#;
    db.execute(Statement::from_string(DbBackend::Sqlite, create_projects.to_owned()))
        .await
        .expect("Failed to create projects table");
    HttpServer::new(move || {
    // CORS config
    let cors = Cors::default()
        .allow_any_origin()
        .allow_any_method()
        .allow_any_header()
        .max_age(3600);

        App::new()
            .app_data(web::Data::new(db.clone()))
            .wrap(cors)
            // API routes under /api
            .service(
                web::scope("/api")
                    .route("/signup", web::post().to(handle_signup))
                    .route("/login", web::post().to(handle_login))
                    .route("/logout", web::post().to(handle_logout))
                    .route("/me", web::get().to(handle_me))
                    // Create a new research project (starts a session)
                    .route("/project", web::post().to(handle_new_project))
                    .route("/project/{id}", web::get().to(handle_get_project))
                    .route("/projects", web::get().to(handle_list_projects))
            )
            // Static assets for SPA (responds to GET/HEAD only)
            .service(
                Files::new("/", "./frontend/out")
                    .index_file("index.html")
            )
    })
    .bind(("127.0.0.1", 4000))?
    .run()
    .await
}

/// Login request payload
#[derive(Debug, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

/// Signup request payload
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignupRequest {
    full_name: String,
    email: String,
    password: String,
    affiliation: String,
    specialization: String,
    invitation_code: Option<String>,
}

/// Generic API response
/// Standard API response, with optional JWT
#[derive(Serialize)]
struct ApiResponse {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    token: Option<String>,
}
/// Response for /me endpoint, returns the user full name
#[derive(Serialize)]
struct MeResponse {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    full_name: Option<String>,
}

/// Handle user signup: insert new user via SeaORM
async fn handle_signup(
    db: web::Data<DatabaseConnection>,
    form: web::Json<SignupRequest>
) -> impl Responder {
    let req = form.into_inner();
    // Hash password
    let hashed = match hash(&req.password, DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => return HttpResponse::InternalServerError().json(ApiResponse { success: false, message: "Password hashing failed".into(), token: None }),
    };
    // Prepare ActiveModel
    let now = Utc::now();
    let user = UserActiveModel {
        id: Default::default(),
        full_name: Set(req.full_name.clone()),
        email: Set(req.email.clone()),
        hashed_password: Set(hashed),
        affiliation: Set(req.affiliation.clone()),
        specialization: Set(req.specialization.clone()),
        invitation_code: Set(req.invitation_code.clone()),
        created_at: Set(now),
    };
    // Insert
    match user.insert(db.get_ref()).await {
        Ok(_) => HttpResponse::Ok().json(ApiResponse { success: true, message: "User created".into(), token: None }),
        Err(e) => HttpResponse::BadRequest().json(ApiResponse { success: false, message: format!("Signup failed: {}", e), token: None }),
    }
}

/// Handle user login: verify credentials via SeaORM
async fn handle_login(
    db: web::Data<DatabaseConnection>,
    form: web::Json<LoginRequest>
) -> impl Responder {
    let req = form.into_inner();
    // Find user by email
    match User::find()
        .filter(UserColumn::Email.eq(req.email.clone()))
        .one(db.get_ref())
        .await
    {
        Ok(Some(user)) => {
            // verify password
            match verify(&req.password, &user.hashed_password) {
                Ok(true) => {
                    // Create JWT claims
                    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".into());
                    let expiration = Utc::now().timestamp() as usize + 3600 * 24;
                    let claims = Claims {
                        sub: user.id,
                        email: user.email.clone(),
                        exp: expiration,
                    };
                    let token = encode(
                        &Header::new(Algorithm::HS256),
                        &claims,
                        &EncodingKey::from_secret(secret.as_ref()),
                    ).unwrap_or_default();
                    HttpResponse::Ok().json(ApiResponse { success: true, message: "Login successful".into(), token: Some(token) })
                }
                _ => HttpResponse::Unauthorized().json(ApiResponse { success: false, message: "Invalid credentials".into(), token: None }),
            }
        }
        Ok(None) => HttpResponse::Unauthorized().json(ApiResponse { success: false, message: "Invalid credentials".into(), token: None }),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse { success: false, message: format!("DB error: {}", e), token: None }),
    }
}
/// Handle user logout: stateless JWT, simply acknowledge
async fn handle_logout() -> impl Responder {
    HttpResponse::Ok().json(ApiResponse { success: true, message: "Logged out".into(), token: None })
}

/// Handle fetching current user info
async fn handle_me(
    db: web::Data<DatabaseConnection>,
    req: HttpRequest
) -> impl Responder {
    // Extract Bearer token
    let auth_header = match req.headers().get("Authorization") {
        Some(v) => v.to_str().unwrap_or(""),
        None => return HttpResponse::Unauthorized().json(MeResponse { success: false, message: "Missing Authorization header".into(), full_name: None }),
    };
    if !auth_header.starts_with("Bearer ") {
        return HttpResponse::Unauthorized().json(MeResponse { success: false, message: "Invalid Authorization header".into(), full_name: None });
    }
    let token = &auth_header[7..];
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".into());
    // Decode token
    let token_data = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::new(Algorithm::HS256)
    ) {
        Ok(data) => data,
        Err(_) => return HttpResponse::Unauthorized().json(MeResponse { success: false, message: "Invalid token".into(), full_name: None }),
    };
    // Load user
    let user_id = token_data.claims.sub;
    match User::find_by_id(user_id).one(db.get_ref()).await {
        Ok(Some(user)) => HttpResponse::Ok().json(MeResponse { success: true, message: "OK".into(), full_name: Some(user.full_name) }),
        Ok(None) => HttpResponse::Unauthorized().json(MeResponse { success: false, message: "User not found".into(), full_name: None }),
        Err(e) => HttpResponse::InternalServerError().json(MeResponse { success: false, message: format!("DB error: {}", e), full_name: None }),
    }
}
/// Request payload for creating a new research project
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewProjectRequest {
    title: String,
    problem: String,
    context: Option<String>,
    proof_model: String,
    eval_model: String,
    reform_model: String,
    steps: u32,
    reviews: u8,
    iterations: u8,
    reformat: bool,
    theorem_graph: bool,
}

/// Handle creating a new research project: for now just log the received config
/// Create & start a remote research session for the authenticated user
async fn handle_new_project(
    db: web::Data<DatabaseConnection>,
    req: HttpRequest,
    payload: web::Json<NewProjectRequest>,
) -> impl Responder {
    // Authenticate via Bearer JWT
    let auth_header = req.headers().get("Authorization").and_then(|v| v.to_str().ok()).unwrap_or("");
    if !auth_header.starts_with("Bearer ") {
        return HttpResponse::Unauthorized().json(ApiResponse { success: false, message: "Missing or invalid Authorization header".into(), token: None });
    }
    let token = &auth_header[7..];
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".into());
    let claims = match decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::new(Algorithm::HS256)
    ) {
        Ok(data) => data.claims,
        Err(_) => return HttpResponse::Unauthorized().json(ApiResponse { success: false, message: "Invalid token".into(), token: None }),
    };
    let user_id = claims.sub;
    info!("Starting new remote session for user {}", user_id);
    // Build session config from request
    let req = payload.into_inner();
    // Log project config
    info!("User {} project config: {{ problem: {}, context: {:?}, proof_model: {}, eval_model: {}, reform_model: {}, steps: {}, reviews: {}, iterations: {}, reformat: {}, theorem_graph: {} }}",
        user_id,
        req.problem,
        req.context,
        req.proof_model,
        req.eval_model,
        req.reform_model,
        req.steps,
        req.reviews,
        req.iterations,
        req.reformat,
        req.theorem_graph
    );
    let mut config = ResearchSessionConfig::new()
        .title(req.title.clone())
        .proof_model(req.proof_model)
        .eval_model(req.eval_model)
        .reform_model(req.reform_model)
        .steps(req.steps)
        .reviews(req.reviews)
        .iterations(req.iterations)
        .reformat(req.reformat)
        .streaming(false)
        .theorem_graph_mode(req.theorem_graph);
    config.set_problem(req.problem);
    if let Some(c) = req.context {
        config.set_context(c);
    }
    // Initialize and spawn background research task
    let db_conn = db.get_ref().clone();
    tokio::spawn(async move {
        let mut session = ResearchSession::new(config);
        if let Err(e) = session.remote_run(&db_conn, user_id).await {
            error!("remote_run failed: {}", e);
        }
    });
    // Immediate response
    HttpResponse::Ok().json(ApiResponse { success: true, message: "Project submitted and session started".into(), token: None })
}

/// Structure returned for project listings
#[derive(Serialize)]
struct ProjectInfo {
    id: i32,
    title: String,
    problem: String,
    context: Option<String>,
    created_at: String,
    last_active: String,
    lemmas_count: i32,
}

/// GET /api/projects: list all projects for the authenticated user
async fn handle_list_projects(
    db: web::Data<DatabaseConnection>,
    req: HttpRequest,
) -> impl Responder {
    let auth_header = req.headers().get("Authorization").and_then(|v| v.to_str().ok()).unwrap_or("");
    if !auth_header.starts_with("Bearer ") {
        return HttpResponse::Unauthorized().json(ApiResponse { success: false, message: "Missing or invalid Authorization header".into(), token: None });
    }
    let token = &auth_header[7..];
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".into());
    let claims = match decode::<Claims>(token, &DecodingKey::from_secret(secret.as_ref()), &Validation::new(Algorithm::HS256)) {
        Ok(data) => data.claims,
        Err(_) => return HttpResponse::Unauthorized().json(ApiResponse { success: false, message: "Invalid token".into(), token: None }),
    };
    let user_id = claims.sub;
    let sql = format!(
        "SELECT id, title, problem, context, created_at, last_active, lemmas_count FROM projects WHERE user_id={} ORDER BY last_active DESC", user_id
    );
    match db.get_ref().query_all(Statement::from_string(DbBackend::Sqlite, sql)).await {
        Ok(rows) => {
            let mut list = Vec::new();
            for row in rows {
                let id: i32 = row.try_get("", "id").unwrap_or_default();
                let title: String = row.try_get("", "title").unwrap_or_default();
                let problem: String = row.try_get("", "problem").unwrap_or_default();
                let context: Option<String> = row.try_get("", "context").ok().flatten();
                let created_at: String = row.try_get("", "created_at").unwrap_or_default();
                let last_active: String = row.try_get("", "last_active").unwrap_or_default();
                let lemmas_count: i32 = row.try_get("", "lemmas_count").unwrap_or_default();
                list.push(ProjectInfo { id, title, problem, context, created_at, last_active, lemmas_count });
            }
            HttpResponse::Ok().json(list)
        }
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse { success: false, message: format!("Failed to fetch projects: {}", e), token: None }),
    }
}

// GET /api/project/{id}
/// Return full project details including memory blocks
async fn handle_get_project(
    db: web::Data<DatabaseConnection>,
    req: HttpRequest,
    path: Path<(i32,)>,
) -> impl Responder {
    // Authenticate
    let auth_header = req.headers().get("Authorization").and_then(|v| v.to_str().ok()).unwrap_or("");
    if !auth_header.starts_with("Bearer ") {
        return HttpResponse::Unauthorized().json(ApiResponse { success: false, message: "Missing Authorization".into(), token: None });
    }
    let token = &auth_header[7..];
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".into());
    let claims = match decode::<Claims>(token, &DecodingKey::from_secret(secret.as_ref()), &Validation::new(Algorithm::HS256)) {
        Ok(data) => data.claims,
        Err(_) => return HttpResponse::Unauthorized().json(ApiResponse { success: false, message: "Invalid token".into(), token: None }),
    };
    let user_id = claims.sub;
    let project_id = path.into_inner().0;
    // Query project
    let sql = format!(
        "SELECT id, title, problem, context, memory, created_at, last_active, lemmas_count FROM projects WHERE id={} AND user_id={} LIMIT 1",
        project_id, user_id
    );
    match db.get_ref().query_one(Statement::from_string(DbBackend::Sqlite, sql)).await {
        Ok(Some(row)) => {
            let id: i32 = row.try_get("", "id").unwrap_or_default();
            let title: String = row.try_get("", "title").unwrap_or_default();
            let problem: String = row.try_get("", "problem").unwrap_or_default();
            let context: Option<String> = row.try_get("", "context").ok().flatten();
            let mem_json: String = row.try_get("", "memory").unwrap_or_default();
            let memory: Vec<crate::agents::MemoryBlock> = serde_json::from_str(&mem_json).unwrap_or_default();
            let created_at: String = row.try_get("", "created_at").unwrap_or_default();
            let last_active: String = row.try_get("", "last_active").unwrap_or_default();
            let lemmas_count: i32 = row.try_get("", "lemmas_count").unwrap_or_default();
            #[derive(Serialize)]
            struct ProjectDetail {
                id: i32,
                title: String,
                problem: String,
                context: Option<String>,
                memory: Vec<crate::agents::MemoryBlock>,
                created_at: String,
                last_active: String,
                lemmas_count: i32,
            }
            let detail = ProjectDetail { id, title, problem, context, memory, created_at, last_active, lemmas_count };
            HttpResponse::Ok().json(detail)
        }
        Ok(None) => HttpResponse::NotFound().json(ApiResponse { success: false, message: "Project not found".into(), token: None }),
        Err(e) => HttpResponse::InternalServerError().json(ApiResponse { success: false, message: format!("DB error: {}", e), token: None }),
    }
}
