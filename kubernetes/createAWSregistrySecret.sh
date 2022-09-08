#!/bin/sh

AWS_ACCOUNT=082576982398
export AWS_ACCESS_KEY_ID=`cat ~/.aws/credentials | grep aws_access_key_id | head -1 | cut -d'=' -f2 | sed 's/ //g'`
export AWS_SECRET_ACCESS_KEY=`cat ~/.aws/credentials | grep aws_secret_access_key | head -1 | cut -d'=' -f2 | sed 's/ //g'`
export AWS_REGION=ca-central-1
DOCKER_REGISTRY_SERVER=https://${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com
DOCKER_USER=AWS
DOCKER_PASSWORD=`aws ecr get-login --region ${AWS_REGION} --registry-ids ${AWS_ACCOUNT} | cut -d' ' -f6`
kubectl delete secret aws-registry || true
kubectl create secret docker-registry aws-registry \
--docker-server=$DOCKER_REGISTRY_SERVER \
--docker-username=$DOCKER_USER \
--docker-password=$DOCKER_PASSWORD \
--docker-email=no@email.local
kubectl patch serviceaccount default -p '{"imagePullSecrets":[{"name":"aws-registry"}]}'