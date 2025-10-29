variable "region" {
  type        = string
  description = "AWS region"
}

variable "env" {
  type        = string
  description = "AWS region"
}
variable "ecs_cluster" {
  type        = string
  description = "ECS cluster name"
}

variable "ecs_service" {
  type        = string
  description = "ECS service name"
}

variable "ecr_repo" {
  type        = string
  description = "ECR repository name"
}

variable "task_family" {
  type        = string
  description = "ECS task definition family"
}

variable "image_tag" {
  type        = string
  description = "Docker image tag to deploy"
}
