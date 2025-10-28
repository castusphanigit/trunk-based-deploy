terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "ten-terraform-statefile"
    key            = "ecs-app/${var.env}/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    # dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = "ap-south-1"
}
