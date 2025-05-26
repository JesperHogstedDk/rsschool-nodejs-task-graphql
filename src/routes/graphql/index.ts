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
  }),
});

const UserType = new GraphQLObjectType({
  name: 'User',
  description: 'A user',
  fields: () => ({
    id: { type: new GraphQLNonNull(UUIDType) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
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
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
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
  })
});

const CreatePostInput = new GraphQLInputObjectType({
  name: 'CreatePostInput',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    content: { type: new GraphQLNonNull(GraphQLString) },
    authorId: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const ChangePostInput = new GraphQLInputObjectType({
  name: 'ChangePostInput',
  fields: {
    title: { type: GraphQLString },
    content: { type: GraphQLString },
    authorId: { type: UUIDType },
  },
});

const CreateProfileInput = new GraphQLInputObjectType({
  name: 'CreateProfileInput',
  fields: {
    userId: { type: new GraphQLNonNull(UUIDType) },
    isMale: { type: new GraphQLNonNull(GraphQLBoolean) },
    yearOfBirth: { type: new GraphQLNonNull(GraphQLInt) },
    memberTypeId: { type: new GraphQLNonNull(MemberTypeId) },
  },
});

const ChangeProfileInput = new GraphQLInputObjectType({
  name: 'ChangeProfileInput',
  fields: {
    userId: { type: UUIDType },
    isMale: { type: GraphQLBoolean },
    yearOfBirth: { type: GraphQLInt },
  },
});


const CreateUserInput = new GraphQLInputObjectType({
  name: 'CreateUserInput',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    balance: { type: new GraphQLNonNull(GraphQLFloat) },
  },
});

const ChangeUserInput = new GraphQLInputObjectType({
  name: 'ChangeUserInput',
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
        args: { dto: { type: CreateUserInput } },
        resolve: async (_, { dto }, context: GqlContext) => {
          return await context.prisma.user.create({ data: dto })
        },
      },
      changeUser: {
        type: new GraphQLNonNull(UserType),
        args: {
          dto: { type: ChangeUserInput },
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (_, { dto, id }, context: GqlContext) => {
          return await context.prisma.user.update({
            where: { id },
            data: dto,
          });
        },
      },
      deleteUser: {
        type: new GraphQLNonNull(UUIDType),
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_, { id }, context: GqlContext) => {
          const user = await context.prisma.user.findUnique({ where: { id } });
          await context.prisma.user.delete({ where: { id } });
          return id;
        },
      },
      subscribeTo: {
        type: new GraphQLNonNull(GraphQLString),
        args: { userId: { type: new GraphQLNonNull(UUIDType) }, authorId: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_, { userId, authorId }: { userId: string; authorId: string }, context: GqlContext) => {
          try {
            await context.prisma.subscribersOnAuthors.create({ data: { subscriberId: userId, authorId } });
            return 'Subscription created OK';
          } catch (error) {
            console.error('Error in subscribeTo:', error);
            throw new Error('Failed to create subscription');
          }
        },
      },
      unsubscribeFrom: {
        type: GraphQLBoolean,
        args: { userId: { type: UUIDType }, authorId: { type: UUIDType } },
        resolve: async (_, { userId, authorId }: { userId: string; authorId: string }, context: GqlContext) => {
          return await context.prisma.subscribersOnAuthors.delete({
            where: { subscriberId_authorId: { subscriberId: userId, authorId } }
          })
            .then(() => true)
            .catch(() => false);
        },
      },
      createProfile: {
        type: new GraphQLNonNull(ProfileType),
        args: { dto: { type: CreateProfileInput } },
        resolve: async (_, { dto }, context: GqlContext) => {
          return await context.prisma.profile.create({ data: dto });
        },
      },
      changeProfile: {
        type: new GraphQLNonNull(ProfileType),
        args: {
          dto: { type: ChangeProfileInput },
          id: { type: new GraphQLNonNull(UUIDType) },
        },
        resolve: async (_, { dto, id }, context: GqlContext) => {
          return await context.prisma.profile.update({
            where: { id },
            data: dto,
          });
        },
      },
      deleteProfile: {
        type: new GraphQLNonNull(UUIDType),
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_, { id }, context: GqlContext) => {
          await context.prisma.profile.delete({ where: { id } });
          return id;
        },
      },
      createPost: {
        type: new GraphQLNonNull(PostType),
        args: { dto: { type: CreatePostInput } },
        resolve: async (_, { dto }, context: GqlContext) => {
          return await context.prisma.post.create({ data: dto });
        },
      },
      changePost: {
        type: PostType,
        args: {
          id: { type: new GraphQLNonNull(UUIDType) },
          dto: { type: new GraphQLNonNull(ChangePostInput) },
        },
        resolve: async (_, { id, dto }, context: GqlContext) => {
          return await context.prisma.post.update({
            where: { id },
            data: dto,
          });
        },
      },
      deletePost: {
        type: new GraphQLNonNull(UUIDType),
        args: { id: { type: new GraphQLNonNull(UUIDType) } },
        resolve: async (_, { id }, context: GqlContext) => {
          await context.prisma.post.delete({ where: { id } });
          return id;
        }
      },
    },
  }),
});



export default plugin;
