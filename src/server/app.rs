use actix_web::{web, App, HttpResponse, HttpServer, Responder, HttpRequest};
use actix_files::Files;
use actix_cors::Cors;
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use sea_orm::{Database, DatabaseConnection, Statement, EntityTrait, QueryFilter, ColumnTrait, ActiveModelTrait, Set, ConnectionTrait, DbBackend};
use serde::{Deserialize, Serialize};
use crate::server::entity::user::{Entity as User, ActiveModel as UserActiveModel, Column as UserColumn};
use jsonwebtoken::{encode, decode, EncodingKey, DecodingKey, Header, Algorithm, Validation};

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
