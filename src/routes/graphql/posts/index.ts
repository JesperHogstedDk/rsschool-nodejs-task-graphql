import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PrismaClient } from '@prisma/client';
import { graphql, GraphQLList, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { createGqlResponseSchema, gqlResponseSchema } from '../schemas.js';
import { UUIDType } from '../types/uuid.js';

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
      // const prismaResult = await prisma.post.findMany();
      const result = await graphql({
        schema: schemaPosts,
        source: req.body.query,
        variableValues: req.body.variables,
        contextValue: { prisma },
      });
      reply.type('application/json');
      return result
    },
  });
}

const PostType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: UUIDType },
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    authorId: { type: UUIDType },
  }),
});

type GqlContext = {
  prisma: PrismaClient;
};

const schemaPosts = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      posts: {
        type: new GraphQLList(PostType),
        resolve: async (_, __, context: GqlContext) => {
          try {
            return await context.prisma.post.findMany();
          } catch (error) {
            console.error("Error fetching posts:", error);
            throw new Error("Failed to fetch posts.");
          }
        },
      },
    },
  })
});

// const schema = new GraphQLSchema({
//   query: new GraphQLObjectType({
//     name: 'RootQuery',
//     fields: {
//       title: {
//         type: GraphQLString,
//         resolve: async () => {
//           return 'Hello title!';
//         },
//       },
//       content: {
//         type: GraphQLString,
//         resolve: async () => {

//           return 'Hello content!';
//         },
//       },
//     },
//   }),
// });



export default plugin;
