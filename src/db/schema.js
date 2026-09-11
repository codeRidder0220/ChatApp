import { pgTable, serial, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core"


//schema for signup=> 
export const usersTable = pgTable("users", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    isEmailVerified: boolean("is_email_verified").default(false).notNull(),
    password: varchar("password", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    role: varchar("role",{length:30}).default("user").notNull()
});

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
