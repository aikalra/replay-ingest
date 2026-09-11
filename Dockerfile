FROM node:20-alpine
WORKDIR /app
COPY service.mjs make-key.mjs ./
ENV DATA_DIR=/data PORT=8790
EXPOSE 8790
CMD ["node", "service.mjs"]
