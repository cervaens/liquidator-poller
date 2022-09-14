#!/bin/sh

echo "- Start deploying image version "$VERSION
echo "- Getting production environment file..."
aws s3 cp s3://arkana-liquidator/mainnet.env ~/envs/

echo "- Updating environment variables..."
kubectl delete secret prod-secrets
kubectl create secret generic prod-secrets --from-env-file=/home/ubuntu/envs/mainnet.env

echo "- Setting new app image, updating pods..."
kubectl set image deployments/liquidator-deployment liquidator-poller=082576982398.dkr.ecr.ca-central-1.amazonaws.com/liquidator-poller:$VERSION
