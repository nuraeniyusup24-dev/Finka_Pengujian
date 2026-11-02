import 'dotenv/config'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

function readHiddenPassword(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Jalankan perintah ini langsung di terminal interaktif agar password tidak tampil.')
  }

  return new Promise((resolve, reject) => {
    let password = ''
    const previousEncoding = stdin.readableEncoding
    stdin.setEncoding('utf8')
    stdin.setRawMode(true)
    stdin.resume()
    stdout.write(prompt)

    const finish = (error) => {
      stdin.removeListener('data', onData)
      stdin.setRawMode(false)
      if (previousEncoding) stdin.setEncoding(previousEncoding)
      stdout.write('\n')
      if (error) reject(error)
      else resolve(password)
    }

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('Provisioning dibatalkan.'))
        if (character === '\r' || character === '\n') return finish()
        if (character === '\u007f' || character === '\b') {
          if (password.length) {
            password = Array.from(password).slice(0, -1).join('')
            stdout.write('\b \b')
          }
          continue
        }
        if (character >= ' ') {
          password += character
          stdout.write('*')
        }
      }
    }

    stdin.on('data', onData)
  })
}

if (process.env.NODE_ENV !== 'production') {
  console.error('Tolak: set NODE_ENV=production untuk menjalankan provisioning admin.')
  process.exitCode = 1
} else {
  const prompt = createInterface({ input: stdin, output: stdout })
  let db
  try {
    const nama = await prompt.question('Nama admin: ')
    const username = await prompt.question('Username admin: ')
    prompt.close()

    const password = await readHiddenPassword('Password admin baru (minimal 14 karakter): ')
    const confirmation = await readHiddenPassword('Ulangi password admin: ')
    if (password !== confirmation) throw new Error('Konfirmasi password tidak cocok.')

    const database = await import('../src/db.js')
    db = database.db
    const { createInitialAdmin } = await import('../src/admin-provisioning.js')
    await database.initDb()
    const admin = await createInitialAdmin({ nama, username, password })
    console.log(`Admin awal berhasil dibuat untuk username "${admin.username}". Password tidak ditampilkan.`)
  } catch (error) {
    prompt.close()
    console.error(error.message)
    process.exitCode = 1
  } finally {
    prompt.close()
    if (db) await db.close()
  }
}
