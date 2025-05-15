const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { promisify } = require('util');
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

const createBackup = async () => {
  try {
    const rootFolder = path.join(__dirname, '../../');
    const backupFolder = path.join(__dirname, '../backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.zip`;
    const backupFilePath = path.join(backupFolder, backupFileName);

    try {
      await stat(backupFolder);
    } catch (err) {
      if (err.code === 'ENOENT') {
        await mkdir(backupFolder);
        console.log('Created backups directory');
      } else {
        throw err;
      }
    }

    const output = fs.createWriteStream(backupFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log(`Backup created successfully: ${backupFilePath}`);
      console.log(`Total bytes: ${archive.pointer()}`);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Warning:', err);
      } else {
        throw err;
      }
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    archive.glob('**/*', {
      cwd: rootFolder,
      ignore: ['node_modules/**', 'backups/**', '.git/**'],
      dot: true
    });
    await archive.finalize();

    return backupFilePath;
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
};

module.exports = { createBackup };