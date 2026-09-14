import { text, pgTable, serial, varchar, integer, timestamp, boolean, unique ,index} from "drizzle-orm/pg-core"

//schema for role =>
export const roleTable = pgTable("roles", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 50 }).notNull().unique()
});

//schema for permission =>
export const permissionTable = pgTable("permission", {
    id: serial("id").primaryKey(),

    name: varchar("name", { length: 100 }).notNull().unique()
});

//schema for signup=> 
export const usersTable = pgTable("users", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    isEmailVerified: boolean("is_email_verified").default(false).notNull(),
    password: varchar("password", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    roleId: integer("role_id").references(() => roleTable.id),
    lastSeen: timestamp("last_seen")
});

//schema for role_permission (junction table) =>
export const rolePermissionTable = pgTable("role_permission", {
    id: serial("id").primaryKey(),

    roleId: integer("role_id").notNull().references(() => roleTable.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id").notNull().references(() => permissionTable.id, { onDelete: "cascade" }),

})


//schema for sessions =>
export const sessionTable = pgTable("sessions", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, {
        onDelete: "cascade"
    }),
    refreshTokenHash: varchar("refresh_token_hash", {
        length: 255
    }).notNull(),

    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at")

});

//schema for emailVerificationCode =>
export const emailVerificationTokenTable = pgTable("email_verification_tokens", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, {
        onDelete: "cascade"
    }),
    tokenHash: varchar("token_hash", {
        length: 255
    }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
})

//schema for password_reset_token =>
export const passwordResetTokenTable = pgTable("password_reset_token", {
    id: serial("id").primaryKey(),
    userId: integer("user_id",).notNull().references(() => usersTable.id, {
        onDelete: "cascade"
    }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()

})

// chat table schema =>
export const chatTable = pgTable("chats", {
    id: serial("id").primaryKey(),
    type: varchar("type", { length: 20 }),
    directKey: varchar("direct_key", { length: 100 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
})

// chat_member table =>
export const chatMemberTable = pgTable("chat_member", {
    id: serial("id").primaryKey(),
    chatId: integer("chat_id").notNull().references(() => chatTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 30 }).notNull().default("member"),
    lastReadMessageId: integer("last_read_message_id").references(() => messageTable.id),
    lastReadAt: timestamp("last_read_at"),
    joinedAt: timestamp("joined_at").defaultNow().notNull()
},
    (table) => ({
        uniqueChatMember: unique("unique_chat_member")
            .on(table.chatId, table.userId)
    })
);

//message_table =>
export const messageTable = pgTable("message_table", {
    id: serial("id").primaryKey(),
    chatId: integer("chat_id").notNull().references(() => chatTable.id, { onDelete: "cascade" }),
    senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).default("text").notNull(),
    content: text("content"),
    mediaUrl: text("media_url"),
    mediaMimeType: varchar("media_mime_type", { length: 100 }),
    mediaSize: integer("media_size"),
    deletedAt: timestamp("deleted_at"),
    deletedBy: integer("deleted_by").references(() => usersTable.id),
    replyToMessageId: integer("reply_to_message_id").references(() => messageTable.id),//apne he msg ko refrence kr rhi
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
},
    (table) => ({
        chatMessageIndex: index("chat_message_idx").on(table.chatId, table.createdAt),
        senderMessageIndex: index("sender_messages_idx").on(table.senderId)
    })

)

// group table =>
export const groupTable = pgTable("groups", {
    id: serial("id").primaryKey(),
    chatId: integer("chat_id").notNull().unique().references(() => chatTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    createdBy: integer("created_by").notNull().references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// message status table =>
export const messageReciptsTable = pgTable("message_receipts", {
    id: serial("id").primaryKey(),
    messageId: integer("message_id").notNull().references(() => messageTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull(),
    deliveredAt: timestamp("delivered_at"),
    readAt: timestamp("read_at"),
})

//message Reaction table => 
export const messageReactionTable = pgTable("message_reaction", {
    id: serial("id").primaryKey(),
    messageId: integer("message_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    reaction: varchar("reaction", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
})







