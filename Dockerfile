FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install
EXPOSE 5000
CMD ["bun", "run", "start"]
