const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
const multer = require('multer');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const pdfMake = require('pdfmake');

const app = express();
const port = 3000;

// Konfigurasi MySQL
const db = mysql.createConnection({
  host: 'census-ppl',
  user: 'root',
  password: '',
  database: 'census'
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

// Middleware
app.use(express.json()); // Untuk mem-parsing JSON
app.use(express.urlencoded({ extended: true })); // Untuk mem-parsing URL-encoded data

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Menyimpan file di folder "uploads/"
  },
  filename: function (req, file, cb) {
    // Mengubah nama file agar tidak terjadi duplikasi
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = '.xlsx';
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Membuat middleware multer dengan konfigurasi storage
const upload = multer({ storage: storage });

// Menggunakan middleware multer saat menerima permintaan upload file Excel
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    return;
  }

  const filePath = req.file.path;

  // Membaca file Excel menggunakan ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.xlsx.readFile(filePath)
    .then(() => {
      const worksheet = workbook.getWorksheet(1);

      // Menyiapkan array untuk menyimpan data
      const data = [];

      // Mendapatkan data dari setiap baris pada sheet
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber !== 1) {
          const rowData = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            const cellValue = cell.value;
            if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
              rowData.push(cellValue);
            }
          });
          data.push(rowData);
          console.log(rowData);
        }
      });
      

      // Simpan data ke dalam tabel di database
      const sql = 'INSERT INTO users (fullname, address, phone_number, username, password, role, status) VALUES ?';
      db.query(sql, [data], (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Terjadi kesalahan saat menyimpan data' });
          return;
        }
      });


      // Menghapus file setelah selesai diproses
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(err);
        }
        console.log('File berhasil dihapus');
      });

      res.json({ message: 'Data berhasil diunggah' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat membaca file Excel' });
    });
});

app.get('/download-excel', (req, res) => {
  // Query untuk mendapatkan data dari tabel users
  const query = 'SELECT * FROM users';

  // Eksekusi query
  db.query(query, (error, results) => {
    if (error) {
      console.error('Terjadi kesalahan saat mengambil data dari database:', error);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data dari database' });
      return;
    }

    // Membuat workbook baru
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    // Menambahkan header kolom
    worksheet.addRow(['Fullname', 'Address', 'Phone Number', 'Username', 'Role', 'Status']);

    // Menambahkan data dari query ke dalam worksheet
    results.forEach((row) => {
      worksheet.addRow([
        row.fullname,
        row.address,
        row.phone_number,
        row.username,
        row.role,
        row.status
      ]);
    });

    // Mengubah objek workbook menjadi buffer Excel
    workbook.xlsx.writeBuffer()
      .then((buffer) => {
        // Mengatur header untuk memberi tahu browser bahwa ini adalah file Excel yang akan didownload
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'users.xlsx');

        // Mengirim buffer Excel sebagai respons
        res.send(buffer);
      })
      .catch((error) => {
        console.error('Terjadi kesalahan saat membuat file Excel:', error);
        res.status(500).json({ error: 'Terjadi kesalahan saat membuat file Excel' });
      });
  });
});

app.get('/download-pdf', (req, res) => {
  // Query untuk mendapatkan data dari tabel users
  const query = 'SELECT * FROM users';

  // Eksekusi query
  db.query(query, (error, results) => {
    if (error) {
      console.error('Terjadi kesalahan saat mengambil data dari database:', error);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data dari database' });
      return;
    }

    // Membuat file PDF baru
    const pdfDoc = new PDFDocument();

    // Mengatur header untuk memberi tahu browser bahwa ini adalah file PDF yang akan didownload
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'users.pdf');

    // Mengalihkan output PDF ke respons HTTP
    pdfDoc.pipe(res);

    // Menambahkan data dari query ke dalam file PDF
    results.forEach((row) => {
      pdfDoc.text(`Fullname: ${row.fullname}`);
      pdfDoc.text(`Address: ${row.address}`);
      pdfDoc.text(`Phone Number: ${row.phone_number}`);
      pdfDoc.text(`Username: ${row.username}`);
      pdfDoc.text(`Role: ${row.role}`);
      pdfDoc.text(`Status: ${row.status}`);
      pdfDoc.moveDown();
    });

    // Mengakhiri dan mengirimkan file PDF
    pdfDoc.end();
  });
});

app.get('/download-pdf-table', (req, res) => {
  // Query untuk mendapatkan data dari tabel users
  const query = 'SELECT * FROM users';

  // Eksekusi query
  db.query(query, (error, results) => {
    if (error) {
      console.error('Terjadi kesalahan saat mengambil data dari database:', error);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data dari database' });
      return;
    }

    // Membuat file PDF baru
    const pdfDoc = new PDFDocument();

    // Mengatur header untuk memberi tahu browser bahwa ini adalah file PDF yang akan didownload
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'users.pdf');

    // Mengalihkan output PDF ke respons HTTP
    pdfDoc.pipe(res);

    // Membuat header kolom tabel
    pdfDoc.font('Helvetica-Bold');
    pdfDoc.fontSize(12);
    pdfDoc.text(`HARUSNYA TABEL`);
    pdfDoc.text('Fullname', { width: 200, align: 'left' });
    pdfDoc.text('Address', { width: 200, align: 'left' });
    pdfDoc.text('Phone Number', { width: 100, align: 'left' });
    pdfDoc.text('Username', { width: 100, align: 'left' });
    pdfDoc.text('Role', { width: 100, align: 'left' });
    pdfDoc.text('Status', { width: 100, align: 'left' });
    pdfDoc.moveDown();

    // Menambahkan data dari query ke dalam tabel
    pdfDoc.font('Helvetica');
    pdfDoc.fontSize(10);
    results.forEach((row) => {
      pdfDoc.text(row.fullname, { width: 200, align: 'left' });
      pdfDoc.text(row.address, { width: 200, align: 'left' });
      pdfDoc.text(row.phone_number.toString(), { width: 100, align: 'left' });
      pdfDoc.text(row.username, { width: 100, align: 'left' });
      pdfDoc.text(row.role, { width: 100, align: 'left' });
      pdfDoc.text(row.status, { width: 100, align: 'left' });
      pdfDoc.moveDown();
    });

    // Mengakhiri dan mengirimkan file PDF
    pdfDoc.end();
  });
});


app.get('/download-pdfmake', (req, res) => {
  // Query to retrieve data from the users table
  const query = 'SELECT * FROM users';

  // Execute the query
  db.query(query, (error, results) => {
    if (error) {
      console.error('An error occurred while retrieving data from the database:', error);
      res.status(500).json({ error: 'An error occurred while retrieving data from the database' });
      return;
    }

    var fonts = {
      Roboto: {
        normal: './fonts/Roboto-Regular.ttf',
        bold: './fonts/Roboto-Medium.ttf',
        italics: './fonts/Roboto-Italic.ttf',
        bolditalics: './fonts/Roboto-MediumItalic.ttf'
      }
    };
    // Prepare the data for the table in the format expected by pdfmake
    const tableData = [];
    tableData.push([
      'Fullname',
      'Address',
      'Phone Number',
      'Username',
      'Role',
      'Status'
    ]);

    results.forEach((row) => {
      tableData.push([
        row.fullname,
        row.address,
        row.phone_number.toString(),
        row.username,
        row.role,
        row.status
      ]);
    });

    // Create the table definition with appropriate column sizes
    const table = {
      headerRows: 1,
      widths: ['*', '*', '*', '*', '*', '*'],
      body: tableData
    };

    // Configure the PDF document with the table
    const docDefinition = {
      content: [
        { text: 'Data Users', style: 'header' },
        { table: table }
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          marginBottom: 10
        }
      }
    };

    // Create a pdfMake object with the document configuration
    const printer = new pdfMake(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set the headers to inform the browser that this is a downloadable PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'users.pdf');

    // Pipe the PDF output to the HTTP response
    pdfDoc.pipe(res);

    // End and send the PDF file
    pdfDoc.end();
  });
});



app.post('/register', (req, res) => {
  const { fullname, address, phone_number, username, password, role} = req.body;

  // Enkripsi password
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mendaftar' });
      return;
    }

    // Simpan data user baru ke database
    const newUser = { fullname, address, phone_number, username, password: hash, role };
    db.query('INSERT INTO users SET ?', newUser, (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Something Wrong With Register' });
        return;
      }
      res.status(201).json({ message: 'Registering Success' });
    });
  });
});



app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log(username,password);
  // Ambil data user berdasarkan username
  db.query(
    'SELECT * FROM users WHERE username = ?',
    username,
    (err, results) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan saat login' });
        return;
      }

      // Periksa apakah username ditemukan
      if (results.length === 0) {
        res.status(401).json({ error: 'Username atau password salah' });
        return;
      }

      const user = results[0];

      // Periksa apakah akun aktif atau tidak aktif
      if (user.status === 'inactive') {
        res.status(401).json({ error: 'Akun tidak aktif' });
        return;
      }

      // Periksa kesesuaian password yang diinput dengan password di database
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'Terjadi kesalahan saat login' });
          return;
        }

        if (isMatch) {
          // Login berhasil, kirimkan informasi role
          // const { id, username, role } = user;
          res.status(200).json({ user });
        } else {
          res.status(401).json({ error: 'Username atau password salah' });
        }
      });
    }
  );
});

// GET endpoint untuk mengambil semua data users
app.get('/users', (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data users' });
      return;
    }

    // Mengirimkan data users sebagai respons
    res.json(results);
  });
});

// GET endpoint untuk mengambil data user berdasarkan ID
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;

  db.query('SELECT * FROM users WHERE id = ?', userId, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data user' });
      return;
    }

    // Memeriksa apakah data user ditemukan
    if (results.length === 0) {
      res.status(404).json({ error: 'User tidak ditemukan' });
      return;
    }

    // Mengirimkan data user sebagai respons
    res.json(results[0]);
  });
});

// POST endpoint untuk melakukan update pada data user
app.post('/users/update', (req, res) => {
  const { id, fullname, address, phone_number, username, password, role } = req.body;

  const updatedData = {
    fullname,
    address,
    phone_number,
    username,
    password,
    role
  };

  db.query('UPDATE users SET ? WHERE id = ?', [updatedData, id], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengupdate data user' });
      return;
    }

    console.log('Data user berhasil diupdate');

    // Mengirimkan respons bahwa data user berhasil diupdate
    res.json({ message: 'Data user berhasil diupdate' });
  });
});


app.delete('/users/:id', (req, res) => {
  const userId = req.params.id;

  db.query('DELETE FROM users WHERE id = ?', userId, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat menghapus user' });
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).json({ error: 'User tidak ditemukan' });
      return;
    }

    console.log('User berhasil dihapus');

    // Mengirimkan respons bahwa user berhasil dihapus
    res.json({ message: 'User berhasil dihapus' });
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.post('/family/add', (req, res) => {
  const { nkk, address} = req.body;
  const status = "active";
  // Enkripsi password

    // Simpan data user baru ke database
    const newFamily = { nkk, address, status };
    db.query('INSERT INTO family SET ?', newFamily, (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Something Wrong' });
        return;
      }
      res.status(201).json({ message: ' Success' });
    });
});

app.get('/family', (req, res) => {
  db.query('SELECT * FROM family', (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data users' });
      return;
    }

    // Mengirimkan data users sebagai respons
    res.json(results);
  });
});

// GET endpoint untuk mengambil data user berdasarkan ID
app.get('/family/:nkk', (req, res) => {
  const userId = req.params.nkk;

  db.query('SELECT * FROM family WHERE nkk = ?', userId, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data user' });
      return;
    }

    // Memeriksa apakah data user ditemukan
    if (results.length === 0) {
      res.status(404).json({ error: 'User tidak ditemukan' });
      return;
    }

    // Mengirimkan data user sebagai respons
    res.json(results[0]);
  });
});

// POST endpoint untuk melakukan update pada data user
app.post('/family/update', (req, res) => {
  const { nkk, address, family_head, status } = req.body;

  const updatedData = {
    address,
    family_head,
    status
  };

  db.query('UPDATE family SET ? WHERE nkk = ?', [updatedData, nkk], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengupdate data user' });
      return;
    }

    console.log('Data user berhasil diupdate');

    // Mengirimkan respons bahwa data user berhasil diupdate
    res.json({ message: 'Data user berhasil diupdate' });
  });
});

app.delete('/family/:nkk', (req, res) => {
  const userId = req.params.nkk;

  db.query('DELETE FROM family WHERE nkk = ?', userId, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat menghapus user' });
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).json({ error: 'User tidak ditemukan' });
      return;
    }

    console.log('User berhasil dihapus');

    // Mengirimkan respons bahwa user berhasil dihapus
    res.json({ message: 'User berhasil dihapus' });
  });
});

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

app.post('/resident/add', (req, res) => {
  const { nik, fullname, birthplace, birthdate, marital_status, gender, job, education, disability } = req.body;
  const status = "active";
  // Enkripsi password

    // Simpan data user baru ke database
    const newResident = { nik, fullname, birthplace, birthdate, marital_status, gender, job, education, disability, status };
    db.query('INSERT INTO resident SET ?', newResident, (err, result) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Something Wrong' });
        return;
      }
      res.status(201).json({ message: ' Success' });
    });
});

app.get('/resident', (req, res) => {
  db.query('SELECT * FROM resident', (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data users' });
      return;
    }

    // Mengirimkan data users sebagai respons
    res.json(results);
  });
});

app.get('/resident/asc', (req, res) => {
  db.query('SELECT * FROM resident ORDER BY last_updated ASC', (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data resident' });
      return;
    }

    // Send the resident data sorted by last_updated in ascending order
    res.json(results);
  });
});

app.get('/resident/desc', (req, res) => {
  db.query('SELECT * FROM resident ORDER BY last_updated DESC', (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data resident' });
      return;
    }

    // Send the resident data sorted by last_updated in ascending order
    res.json(results);
  });
});


app.get('/resident/statistics', (req, res) => {
  const query1 = 'SELECT COUNT(*) AS maleCount FROM resident WHERE gender = "male"';
  const query2 = 'SELECT COUNT(*) AS femaleCount FROM resident WHERE gender = "female"';
  const query3 = 'SELECT COUNT(*) AS joblessCount FROM resident WHERE job = "jobless"';
  const query4 = 'SELECT COUNT(*) AS disabilityCount FROM resident WHERE disability IS NOT NULL';

  db.query(`${query1}; ${query2}; ${query3}; ${query4}`, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data statistik' });
      return;
    }

    const [maleResult, femaleResult, joblessResult, disabilityResult] = results;

    const maleCount = maleResult[0].maleCount;
    const femaleCount = femaleResult[0].femaleCount;
    const joblessCount = joblessResult[0].joblessCount;
    const disabilityCount = disabilityResult[0].disabilityCount;

    const statistics = {
      maleCount,
      femaleCount,
      joblessCount,
      disabilityCount
    };

    res.json(statistics);
  });
});


// GET endpoint untuk mengambil data user berdasarkan ID
app.get('/resident/:nik', (req, res) => {
  const userId = req.params.nik;

  db.query('SELECT * FROM resident WHERE nik = ?', userId, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data user' });
      return;
    }

    // Memeriksa apakah data user ditemukan
    if (results.length === 0) {
      res.status(404).json({ error: 'User tidak ditemukan' });
      return;
    }

    // Mengirimkan data user sebagai respons
    res.json(results[0]);
  });
});

// POST endpoint untuk melakukan update pada data user
app.post('/resident/update', (req, res) => {
  const { nik, fullname, birthplace, birthdate, marital_status, gender, job, education, disability, status } = req.body;

  let date_time = new Date();
  let date = ("0" + date_time.getDate()).slice(-2);
  let month = ("0" + (date_time.getMonth() + 1)).slice(-2);
  let year = date_time.getFullYear();
  last_updated = year + "-" + month + "-" + date

  const updatedData = {
    fullname,
    birthplace, 
    birthdate, 
    marital_status, 
    gender, 
    job, 
    education, 
    disability, 
    status,
    last_updated
  };

  db.query('UPDATE resident SET ? WHERE nik = ?', [updatedData, nik], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengupdate data user' });
      return;
    }

    console.log('Data user berhasil diupdate');

    // Mengirimkan respons bahwa data user berhasil diupdate
    res.json({ message: 'Data user berhasil diupdate' });
  });
});

app.delete('/resident/:nik', (req, res) => {
  const userId = req.params.nik;

  db.query('DELETE FROM resident WHERE nik = ?', userId, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Terjadi kesalahan saat menghapus user' });
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).json({ error: 'User tidak ditemukan' });
      return;
    }

    console.log('User berhasil dihapus');

    // Mengirimkan respons bahwa user berhasil dihapus
    res.json({ message: 'User berhasil dihapus' });
  });
});


app.listen(port, () => {
  console.log('Server berjalan pada http://localhost:3000');
});
