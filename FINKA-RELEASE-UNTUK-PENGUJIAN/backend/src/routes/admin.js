import { Router } from 'express'
import { adminUsersRouter } from './admin/users.js'
import { adminReportsRouter } from './admin/reports.js'
import { adminAccountsRouter } from './admin/accounts.js'
import { adminBillingRouter } from './admin/billing.js'
import { adminClassesRouter } from './admin/classes.js'
import { adminCashRouter } from './admin/cash.js'

// Semua endpoint /api/admin dikumpulkan di sini.
// Detail fitur dipisah berdasarkan tanggung jawab agar file tetap mudah dibaca.
export const adminRouter = Router()

adminRouter.use('/', adminUsersRouter)
adminRouter.use('/', adminReportsRouter)
adminRouter.use('/', adminAccountsRouter)
adminRouter.use('/', adminBillingRouter)
adminRouter.use('/', adminClassesRouter)
adminRouter.use('/', adminCashRouter)

