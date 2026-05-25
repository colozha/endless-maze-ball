# Maze Ball

Maze Ball adalah game labirin portrait berbasis HTML, CSS, dan JavaScript murni.
Pemain menggerakkan bola dari Start ke Finish, menghindari duri, dan naik level tanpa batas.

## Cara Menjalankan

Buka file `index.html` langsung di browser.

Tidak perlu install dependency.
Tidak ada framework atau library eksternal.

## Struktur File

- `index.html`: struktur halaman Home, Game, dan Game Over.
- `style.css`: styling, layout responsif, HUD, joystick, dan tampilan game.
- `script.js`: logika game, maze generation, input, rendering canvas, audio, dan storage.
- `GAME_REFERENCE.md`: dokumentasi teknis ringkas untuk AI agent atau developer.

## Fitur Utama

- Maze random di setiap level.
- Level tidak terbatas.
- High score tersimpan di `localStorage`.
- Continue progress jika game belum berakhir.
- Mode difficulty: Easy dan Hard.
- Canvas responsif dengan rasio portrait.
- Kontrol keyboard, joystick, dan swipe.
- Sound effect untuk move, success, fail, shield pickup, dan shield expire.

## Kontrol

- Keyboard: Arrow keys atau WASD.
- Joystick: tombol arah transparan di area game.
- Swipe: geser di area labirin.
- Swipe-hold: swipe lalu tahan untuk bergerak otomatis bertahap.
- Tombol `Controls` di header bisa menampilkan atau menyembunyikan joystick.

## Difficulty

### Easy

- Tidak ada duri bergerak.
- Tidak ada duri homing.
- Duri muncul setiap 5-10 detik.

### Hard

- Semua fitur duri aktif.
- Duri muncul setiap 3-7 detik.
- Level 11-20 memiliki sebagian duri bergerak maju.
- Level 21+ memiliki sebagian duri homing yang mengejar bola.

## Item dan Hazard

- Duri: mengurangi 1 nyawa jika terkena.
- Life token: muncul di level kelipatan 7 dan menambah 1 nyawa.
- Shield token: mulai level 6 punya peluang muncul 25%.
- Shield aktif selama 10 detik dan membuat bola kebal dari duri.

## Progress dan Storage

Game menggunakan `localStorage`.

- `mazeBallHighScore`: high score level tertinggi.
- `mazeBallProgress`: progress level, nyawa, dan difficulty.
- `mazeBallControlsVisible`: status show/hide joystick.
- `mazeBallDifficulty`: difficulty terakhir yang dipilih.

Progress dihapus saat Game Over atau saat memulai game baru.

## Catatan Developer

- Jalankan validasi JavaScript dengan:

```bash
node --check script.js
```

- Jangan menambahkan dependency eksternal kecuali memang diperlukan.
- Jika mengubah timer, interval, atau timeout, pastikan dibersihkan saat restart, game over, dan back home.
- Jika mengubah input, pastikan keyboard, joystick, dan swipe tetap berfungsi.
