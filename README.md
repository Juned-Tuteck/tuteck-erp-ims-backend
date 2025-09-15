tuteck-erp-ims-backend

# Deployment process

## ims backend
docker buildx build -t contromoist-revamp-api-ims-image .
docker  save -o ./contromoist-revamp-api-ims-image.tar contromoist-revamp-api-ims-image

docker load -i contromoist-revamp-api-ims-image.tar
docker run -d -p 7322:7322 --env-file .env --name contromoist-revamp-api-ims-container contromoist-revamp-api-ims-image

------------

scp "C:\Users\sk.juned\Documents\Contromoist-Revamp\Backend\tuteck-erp-ims-backend\contromoist-revamp-api-ims-image.tar" contromoist_dev@103.127.31.183:~/revamp/backend/ims

scp "C:\Users\sk.juned\Documents\Contromoist-Revamp\Backend\tuteck-erp-ims-backend\.env" contromoist_dev@103.127.31.183:~/revamp/backend/ims

yrf$ww2$667