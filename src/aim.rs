use tokio::task::JoinSet;

use crate::sessions::{Session, ResearchSessionConfig, ResearchSession};
use crate::server;

use log::{info, error};

pub struct AIM {
    tokio_set: JoinSet<()>,
}

impl AIM {
    pub fn new() -> Self {
        AIM {
            tokio_set: JoinSet::new()
        }
    }

    /// Run the HTTP server at the given bind address (e.g., "0.0.0.0:4000").
    pub async fn runserver(&mut self, bind_addr: &str) -> Result<(), Box<dyn std::error::Error>> {
        server::app::run(bind_addr).await?;
        Ok(())
    }

    pub async fn run_session(&mut self, config: ResearchSessionConfig) ->  Result<(), Box<dyn std::error::Error>> {
        let mut session = ResearchSession::new(config);
        self.tokio_set.spawn(async move {
            if let Err(e) = session.run().await {
                error!("ResearchSession failed with error: {}", e);
            }
        });

        while let Some(res) = self.tokio_set.join_next().await {
            match res {
                Ok(()) => info!("Task Completed!"),
                Err(e) => error!("Task Failed: {}", e),
            }
        }

        Ok(())
    }
}
