const prismaConfig = {
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.POSTGRES_PRISMA_URL,
    shadowDatabaseUrl: process.env.POSTGRES_URL_NON_POOLING,
  },
};

export default prismaConfig;
