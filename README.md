# Maze Ball

Maze Ball adalah game labirin portrait berbasis HTML, CSS, dan JavaScript murni.
Pemain menggerakkan bola dari Start ke Finish, menghindari duri, dan naik level tanpa batas.

## Cara Menjalankan

Buka file `index.html` langsung di browser.

Tidak perlu install dependency.
Tidak ada framework atau library eksternal.

## Struktur File

- `index.html`: struktur halaman Home, Game, dan Game Over.
- `css/style.css`: styling, layout responsif, HUD, joystick, dan tampilan game.
- `js/config.js`: config balancing, constants, debug flag, dan storage keys.
- `js/audio.js`: sound effect berbasis Web Audio API.
- `js/script.js`: logika game utama, maze generation, input, rendering canvas, hazard, dan storage.
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
- Tema visual per level: blue, orange hazard, dan neon danger.
- Animasi token, particle pickup, shield pulse, player trail, dan transition saat naik level.

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
- Level 21+ memiliki sebagian duri homing yang mengejar bola melalui jalur maze selama 10 detik.
- Duri homing menghitung ulang jalur jika tersangkut dan arah segitiganya mengikuti arah gerakan.

## Item dan Hazard

- Duri: mengurangi 1 nyawa jika terkena.
- Life token: muncul di level kelipatan 7 dan menambah 1 nyawa.
- Shield token: mulai level 6 punya peluang muncul 25%.
- Shield aktif selama 10 detik dan membuat bola kebal dari duri.

## Visual Themes

- Level 1-10: Blue Maze.
- Level 11-20: Orange Hazard.
- Level 21+: Neon Danger.

Visual feedback tambahan:

- Token memiliki animasi spawn dan despawn.
- Token pickup memunculkan particle kecil.
- Shield aktif punya efek pulse di sekitar bola.
- Bola punya trail halus saat bergerak.
- Saat naik level, muncul transition overlay singkat.

## Progress dan Storage

Game menggunakan `localStorage`.

- `mazeBallHighScore`: high score level tertinggi.
- `mazeBallProgress`: progress level, nyawa, dan difficulty.
- `mazeBallControlsVisible`: status show/hide joystick.
- `mazeBallDifficulty`: difficulty terakhir yang dipilih.

Progress dihapus saat Game Over atau saat memulai game baru.

## Catatan Developer

- Gameplay balancing utama berada di `GAME_CONFIG` dalam `js/config.js`.
- Key `localStorage` berada di `STORAGE_KEYS` dalam `js/config.js`.
- Mapping keyboard berada di `DIRECTION_BY_KEY` dalam `js/config.js`.
- Sound effect berada di `js/audio.js`.
- `script.js` memakai section header untuk memisahkan lifecycle, rendering, hazard, storage, audio, dan input.
- Cleanup timer/input aktif memakai `clearActiveRunState()` dan `clearLevelTimers()`.
- Debug canvas bisa diaktifkan dengan membuka `index.html?debug=1`.
- Debug testing flags:

```text
index.html?debug=1&level=21&difficulty=hard&forceHoming=1
index.html?debug=1&level=11&difficulty=hard&forceMoving=1
index.html?debug=1&forceLifeToken=1&forceShieldToken=1
index.html?debug=1&noSpike=1
index.html?debug=1&invincible=1
```

- Jalankan validasi JavaScript dengan:

```bash
node --check js/script.js
```

- Jangan menambahkan dependency eksternal kecuali memang diperlukan.
- Jika mengubah timer, interval, atau timeout, pastikan dibersihkan saat restart, game over, dan back home.
- Jika mengubah input, pastikan keyboard, joystick, dan swipe tetap berfungsi.
