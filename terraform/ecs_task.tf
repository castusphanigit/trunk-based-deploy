data "aws_ecr_repository" "repo" {
  name = var.ecr_repo
}

resource "aws_ecs_task_definition" "app" {
  family                   = var.task_family
  container_definitions    = jsonencode([
    {
      name      = "ten-app"
      image     = "${data.aws_ecr_repository.repo.repository_url}:${var.image_tag}"
      essential = true
      portMappings = [{ containerPort = 9330 }]
    }
  ])
}