import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { graphql } from 'graphql';
import { schema } from '../index.js';
import { createGqlResponseSchema, gqlResponseSchema } from '../schemas.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { prisma } = fastify;

  fastify.route({
    url: '/',
    method: 'POST',
    schema: {
      ...createGqlResponseSchema,
      response: {
        200: gqlResponseSchema,
      },
    },
    async handler(req, reply) {
       const result = await graphql({
        schema: schema,
        source: req.body.query,
        variableValues: req.body.variables,
        contextValue: { prisma },
      });
      reply.type('application/json');
      return result
    },
  });
}

export default plugin;
