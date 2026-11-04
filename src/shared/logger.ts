import pino from 'pino'
import { config } from '../config/env'

export const logger = pino({
  level: config.logLevel,
  base: undefined,
  ...(config.nodeEnv === 'development'
    ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } } }
    : {}),
})

export type Logger = typeof logger
