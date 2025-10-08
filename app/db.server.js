import { PrismaClient } from "@prisma/client";

let prisma;

// Connection pooling configuration for serverless environments
const prismaConfig = {
  datasources: {
    db: {
      url: process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
  // Optimize for serverless environments
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
};

// In development, store the prisma client as a global variable
// so it's not recreated on every hot reload
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient(prismaConfig);
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient(prismaConfig);
  }
  prisma = global.__prisma;
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
