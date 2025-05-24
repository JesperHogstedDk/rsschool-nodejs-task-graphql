import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import { graphql, GraphQLID, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { Prisma, PrismaClient } from '@prisma/client';
import { UUIDType } from './types/uuid.js';

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
      try {
        const result = await graphql({
          schema,
          source: req.body.query,
          variableValues: req.body.variables,
          contextValue: { prisma }
        });
        reply.type('application/json');
        return result;
      } catch (error) {
        console.log('Error: ', error);
        return reply.status(500).send({ errors: [{ message: "Internal Server Error" }] });
      }
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

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQuery',
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
      post: {
        type: PostType,
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_, { id }, context: GqlContext) => {
          try {
            return await context.prisma.post.findUnique({ where: { id } });
          } catch (error) {
            console.error("Error fetching post:", error);            
          }
        },
      },
    },
  }),
});



export default plugin;
