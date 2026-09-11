import { pgTable, serial, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core"

//schema for role =>
export const roleTable = pgTable("roles",{
    id:serial("id").primaryKey(),
    name:varchar("name",{length:50}).notNull().unique()
});

//schema for permission =>
export const permissionTable = pgTable("permission",{
    id:serial("id").primaryKey(),

    name:varchar("name",{length:100}).notNull().unique()
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
    roleId: integer("role_id").references(()=>roleTable.id)
});

//schema for role_permission (junction table) =>
export const rolePermissionTable = pgTable("role_permission",{
    id:serial("id").primaryKey(),

    roleId: integer("role_id").notNull().references(()=>roleTable.id , {onDelete:"cascade"}),
    permissionId: integer("permission_id").notNull().references(()=>permissionTable.id , {onDelete:"cascade"}),

})


//schema for sessions =>
export const sessionTable = pgTable("sessions", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(()=>usersTable.id,{
        onDelete: "cascade"
    }),
    refreshTokenHash: varchar("refresh_token_hash" , {
        length:255
    }).notNull(),

    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at")

});

//schema for emailVerificationCode =>
export const emailVerificationTokenTable = pgTable("email_verification_tokens",{
    id:serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(()=>usersTable.id , {
        onDelete:"cascade"
    }),
    tokenHash: varchar("token_hash" , {
        length:255
    }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
})

//schema for password_reset_token =>
export const passwordResetTokenTable = pgTable("password_reset_token",{
    id:serial("id").primaryKey(),
    userId: integer("user_id",).notNull().references(()=>usersTable.id,{
        onDelete:"cascade"
    }),
    tokenHash: varchar("token_hash",{length:255}).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()

})





