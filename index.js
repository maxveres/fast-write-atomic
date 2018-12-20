'use strict'

const { open, write, close, rename, fsync, unlink } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')

var counter = 0

function id () {
  return process.pid + '.' + counter++
}

function cleanup (dest, err, cb) {
  unlink(dest, function () {
    cb(err)
  })
}

function closeAndCleanup (fd, dest, err, cb) {
  close(fd, cleanup.bind(dest, err, cb))
}

function writeLoop (fd, content, offset, cb) {
  write(fd, content, offset, function (err, bytesWritten) {
    if (err) {
      cb(err)
      return
    }

    if (bytesWritten !== content.length + offset) {
      writeLoop(fd, content, offset + bytesWritten, cb)
    } else {
      cb(null)
    }
  })
}

function writeAtomic (path, content, cb) {
  const tmp = join(tmpdir(), id())
  open(tmp, 'w', function (err, fd) {
    if (err) {
      cb(err)
      return
    }

    writeLoop(fd, content, 0, function (err) {
      if (err) {
        closeAndCleanup(fd, tmp, err, cb)
        return
      }

      fsync(fd, function (err) {
        if (err) {
          closeAndCleanup(fd, tmp, err, cb)
          return
        }

        close(fd, function (err) {
          if (err) {
            cleanup(tmp, err, cb)
            return
          }

          rename(tmp, path, (err) => {
            if (err) {
              cleanup(tmp, err, cb)
              return
            }

            cb(null)
          })
        })
      })
    })

    // clean up after oursevles, this is not needed
    // anymore
    content = null
  })
}

module.exports = writeAtomic