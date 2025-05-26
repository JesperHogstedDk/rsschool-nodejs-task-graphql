import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PrismaClient } from '@prisma/client';
import { graphql, GraphQLBoolean, GraphQLEnumType, GraphQLFloat, GraphQLInputObjectType, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
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

type GqlContext = {
  prisma: PrismaClient;
};

const MemberTypeId = new GraphQLEnumType({
  name: 'MemberTypeId',
  values: {
    BASIC: { value: 'BASIC' },
    BUSINESS: { value: 'BUSINESS' },
  },
})

const MemberType = new GraphQLObjectType({
  name: 'MemberType',
  fields: () => ({
    id: { type: MemberTypeId },
    discount: { type: GraphQLFloat },
    postsLimitPerMonth: { type: GraphQLInt },
    profiles: {
      type: new GraphQLList(ProfileType),
      resolve: async (parent, _args, context: GqlContext) => {
        try {
          return await context.prisma.profile.findMany({ where: { memberTypeId: parent.id } });
        } catch (error) {
          console.error("Error fetching profiles in MemberType.:", error);
          throw new Error("Failed to fetch profiles in MemberType.");          
        }
      },
    },
  }),
});

const UserType = new GraphQLObjectType({
  name: 'User',
  description: 'A user',
  fields: () => ({
    id: { type: UUIDType },
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
    profile: {
      type: ProfileType,
      resolve: async (parent, _args, context: GqlContext) => {
        return await context.prisma.profile.findUnique({ where: { userId: parent.id } })
      },
    },
    posts: {
      type: new GraphQLList(PostType),
      resolve: async (parent, _args, context: GqlContext) => {
        return await context.prisma.post.findMany({ where: { authorId: parent.id } })
      },
    },
    userSubscribedTo: {
      type: new GraphQLList(new GraphQLNonNull(UserType)),
      resolve: async (parent, _args, context: GqlContext) => {
        const user = await context.prisma.user.findUnique({
          where: { id: parent.id },
          include: { userSubscribedTo: { include: { author: true } } },
        });
        return user?.userSubscribedTo?.map((sub: { author }) => sub.author);
      },
    },
    subscribedToUser: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
      resolve: async (parent, _args, context: GqlContext) => {
        const user = await context.prisma.user.findUnique({
          where: { id: parent.id },
          include: { subscribedToUser: { include: { subscriber: true } } },
        });
        return user?.subscribedToUser?.map((sub: { subscriber }) => sub.subscriber);
      },
    },
  }),
});

const ProfileType = new GraphQLObjectType({
  name: 'Profile',
  fields: () => ({
    id: { type: UUIDType },
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
    userId: { type: UUIDType },
    memberTypeId: { type: MemberTypeId },
    memberType: {
      type: MemberType,
      resolve: async (parent, _args, context: GqlContext) => {
        try {
          return await context.prisma.memberType.findUnique({ where: { id: parent.memberTypeId } });
        } catch (error) {
          console.error("Error fetching memberType in ProfileType.:", error);
          throw new Error("Failed to fetch memberType in ProfileType.");                    
        }
      },
    },
    user: {
      type: UserType,
      resolve: async (parent, _args, context: GqlContext) => {
        try {
          return await context.prisma.user.findUnique({ where: { id: parent.userId } });
        } catch (error) {
          console.error("Error fetching user in ProfileType.:", error);
          throw new Error("Failed to fetch user in ProfileType.");          
        }
      },
    },
  }),
});

const PostType = new GraphQLObjectType({
  name: 'Post',
  fields: () => ({
    id: { type: UUIDType },
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    authorId: { type: UUIDType },
    author: {
      type: UserType,
      resolve: async (parent, _args, context: GqlContext) => {
        try {
          return await context.prisma.user.findUnique({ where: { id: parent.authorId } });
        } catch (error) {
          console.error("Error fetching user in PostType.:", error);
          throw new Error("Failed to fetch user in PostType.");
        }
      },
    }
  }),
});

const CreatePostInputType = new GraphQLInputObjectType({
  name: 'CreatePostInput',
  fields: {
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    authorId: { type: GraphQLString },
  },
});


const CreateProfileInputType = new GraphQLInputObjectType({
  name: 'CreateProfileInput',
  fields: {
    userId: { type: UUIDType },
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
    memberTypeId: { type: MemberTypeId },
  },
});

const CreateUserInputType = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: GraphQLString },
    balance: { type: GraphQLFloat },
  },
});

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
            throw new Error("Failed to fetch post.");
          }
        },
      },
      users: {
        type: new GraphQLList(UserType),
        resolve: async (_, __, context: GqlContext) => {
          try {
            return await context.prisma.user.findMany();
          } catch (error) {
            console.error("Error fetching users:", error);
            throw error;
          }
        }
      },
      user: {
        type: UserType,
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_, { id }, context: GqlContext) => {
          try {
            return await context.prisma.user.findUnique({ where: { id } });
          } catch (error) {
            console.error("Error fetching user:", error);
            throw error;
          }
        },
      },
      memberTypes: {
        type: new GraphQLList(MemberType),
        resolve: async (_, __, context: GqlContext) => {
          try {
            return await context.prisma.memberType.findMany();
          } catch (error) {
            console.error("Error fetching memberTypes:", error);
            throw error;
          }
        }
      },
      memberType: {
        type: MemberType,
        args: { id: { type: MemberTypeId } },
        resolve: async (_, { id }, context: GqlContext) => {
          try {
            return await context.prisma.memberType.findUnique({ where: { id } });
          } catch (error) {
            console.error("Error fetching memberType:", error);
            throw error;
          }
        },
      },
      profiles: {
        type: new GraphQLList(ProfileType),
        resolve: async (_, __, context: GqlContext) => {
          try {
            return await context.prisma.profile.findMany();
          } catch (error) {
            console.error("Error fetching profiles:", error);
            throw error;
          }
        }
      },
      profile: {
        type: ProfileType,
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_, { id }, context: GqlContext) => {
          try {
            return await context.prisma.profile.findUnique({ where: { id } });
          } catch (error) {
            console.error("Error fetching profile:", error);
            throw error;
          }
        },
      },
    },
  }),
  mutation: new GraphQLObjectType({
    name: 'RootMutation',
    fields: {
      createUser: {
        type: new GraphQLNonNull(UserType),
        args: { dto: { type: CreateUserInputType } },
        resolve: (_, { dto }, context: GqlContext) => context.prisma.user.create({ data: dto })
      },
      createPost: {
        type: new GraphQLNonNull(PostType),
        args: { dto: { type: CreatePostInputType } },
        resolve: (_, { dto }, context: GqlContext) => context.prisma.post.create({ data: dto })
      },
      createProfile: {
        type: new GraphQLNonNull(ProfileType),
        args: { dto: { type: CreateProfileInputType } },
        resolve: (_, { dto }, context: GqlContext) => context.prisma.profile.create({ data: dto })
      },
    },
  }),
});



export default plugin;
