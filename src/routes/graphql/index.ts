import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import { graphql, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';

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
        schema,
        source: req.body.query,
        variableValues: req.body.variables,
      });
      reply.type('application/json');
      return result;
    },
  });
}

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQuery',
    fields: {
      testString: {
        type: GraphQLString,
        resolve: async () => {
          return 'Hello world';
        },
      },
    },
  }),
});



export default plugin;
