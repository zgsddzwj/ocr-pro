# ---------- 阶段一：构建前端 ----------
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY platform/frontend/package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install --no-audit --no-fund
COPY platform/frontend/ ./
RUN npm run build

# ---------- 阶段二：后端运行 ----------
FROM python:3.12-slim
WORKDIR /app/backend
COPY platform/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY platform/backend/app ./app
COPY --from=frontend /app/frontend/dist /app/frontend/dist
ENV HOST=0.0.0.0 PORT=8010
EXPOSE 8010
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010"]
