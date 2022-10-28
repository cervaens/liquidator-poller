#!/bin/sh

echo "- Start deploying image version "$VERSION
echo "- Getting production environment file..."
aws s3 cp s3://liquidator-poller/mainnet.env ~/envs/
aws s3 cp s3://liquidator-poller/wallet.env ~/envs/

echo "- Updating environment variables..."
kubectl delete secret prod-secrets
kubectl create secret generic prod-secrets --from-env-file=/home/ubuntu/envs/mainnet.env
kubectl delete secret wallet-secrets
kubectl create secret generic wallet-secrets --from-env-file=/home/ubuntu/envs/wallet.env
rm /home/ubuntu/envs/*

echo "- Setting new app image, updating pods..."
kubectl set image deployments/liquidator-deployment liquidator-poller=082576982398.dkr.ecr.ca-central-1.amazonaws.com/liquidator-poller:$VERSION
