import dotenv from 'dotenv';
dotenv.config();

interface EnvConfig {
    /** Bootstrap nodes coma separated */
    BOOTSTRAP: string;
}

export const config: EnvConfig = {
    BOOTSTRAP: process.env.BOOTSTRAP!,
};
