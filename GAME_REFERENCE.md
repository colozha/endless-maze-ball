# Maze Ball Game Reference

Dokumen ini adalah referensi singkat untuk AI agent sebelum mengubah game.

## Struktur File

- `index.html`: struktur halaman Home, Game, dan End.
- `css/style.css`: layout, HUD, canvas panel, joystick, dan responsive UI.
- `js/config.js`: config balancing, constants, debug flag, dan storage keys.
- `js/audio.js`: Web Audio API dan sound effect.
- `js/script.js`: logika game utama, rendering canvas, input, state, storage, hazard, dan token.

## Konsep Game

`Maze Ball` adalah game labirin portrait berbasis HTML, CSS, dan JavaScript murni.
Player menggerakkan bola dari Start ke Finish.
Saat Finish dicapai, level naik dan labirin dibuat ulang secara random.

## Halaman

- `Home Page`: judul, deskripsi, high score Easy/Hard, tombol Continue jika ada progress, dan Start Game.
- `Game Page`: HUD level, lives, high score, difficulty, boss flag, pause, toggle controls, canvas labirin, dan joystick.
- `End Page`: Game Over, last level, high score, Play Again, dan Back to Home.
- `Tutorial Overlay`: muncul sekali untuk menjelaskan keyboard, joystick, swipe, token, dan shield.
- `Pause Overlay`: resume, restart, dan back home.

## State Utama

State disimpan di object `gameState` dalam `script.js`.

Angka balancing utama disimpan di `GAME_CONFIG` dalam `js/config.js`.
Key `localStorage` disimpan di `STORAGE_KEYS` dalam `js/config.js`.
Mapping keyboard disimpan di `DIRECTION_BY_KEY` dalam `js/config.js`.
`script.js` dibagi dengan section header agar agent mudah menemukan area kerja.

- `level`: level aktif.
- `lives`: jumlah nyawa aktif. Bisa lebih dari 5 jika mengambil token nyawa.
- `maxLives`: nilai awal nyawa, yaitu 5.
- `difficulty`: mode game aktif, `easy` atau `hard`.
- `highScore`: level tertinggi per difficulty dari `localStorage`.
- `maze`: grid labirin.
- `player`: posisi, target, animasi, dan queue gerakan bola.
- `activeSpikes`: duri yang sedang aktif.
- `lifeToken`: token nyawa aktif jika ada.
- `shieldToken`: token shield aktif jika ada.
- `shieldActiveUntil`: waktu berakhirnya efek shield pada bola.
- `particles`: particle pickup token aktif.
- `playerTrail`: titik trail bola saat bergerak.
- `controls`: state joystick, drag, visibility, dan hold input.
- `swipe`: state pointer swipe dan swipe-hold.
- `keyboard`: state keyboard hold.
- `audio`: Web Audio context.
- `isPaused`: status pause aktif.
- `pausedTimers`: registry timeout yang sedang dihentikan saat pause.
- `bossWaveIndex`: urutan pola hazard boss level.

## Labirin

- Grid tetap: `13 x 21`.
- `1` berarti dinding.
- `0` berarti jalan.
- Maze dibuat dengan randomized DFS / recursive backtracking.
- Start berada di area awal.
- Finish berada di area akhir.
- Maze selalu punya jalur valid dari Start ke Finish.

## Kontrol Player

Player bergerak satu cell per input.
Gerakan menggunakan target grid dan animasi smooth.

Input yang didukung:

- Keyboard: Arrow keys dan WASD.
- Joystick: tombol arah di bawah canvas.
- Swipe: gesture di area maze panel atau canvas.
- Swipe-hold: swipe lalu tahan untuk bergerak bertahap.

Catatan:

- Swipe minimal `30px`.
- Swipe hanya aktif saat game berjalan.
- Swipe tidak dipasang ke `body`.
- Canvas dan maze panel memakai `touch-action: none` dan `user-select: none`.

## Joystick

- Joystick bisa ditampilkan atau disembunyikan dari tombol `Controls` di HUD.
- State show/hide disimpan di `localStorage` dengan key `mazeBallControlsVisible`.
- Joystick bisa digeser oleh user.
- Tombol joystick mendukung hold-to-move.

## Duri

Duri muncul random di cell jalan yang punya sisi dinding.
Duri tidak muncul di Start, Finish, atau posisi player.

Interval spawn duri:

- Easy: setiap `5-10 detik`.
- Hard: setiap `3-7 detik`.
- Duri aktif selama `2-4 detik`.

Jumlah duri berdasarkan level:

- Jumlah duri memakai formula gradual dari `GAME_CONFIG.spikes.scaling`.
- Base count dimulai dari `5`.
- Count bertambah pelan per level dan di-random dengan spread kecil.
- Count maksimal adalah `50`.

Jika bola terkena duri:

- Nyawa berkurang 1.
- Bola kembali ke Start.
- Duri aktif dihapus.
- Jika nyawa 0, game pindah ke End Page.

### Duri Bergerak Level 11-20

Pada level `11-20`, sebagian duri bisa bergerak hanya di mode Hard.

- Berlaku setiap fase duri muncul ke arena.
- Duri yang memenuhi syarat adalah duri yang menghadap lebih dari 1 grid kosong.
- Game memilih sekitar `20%` dari duri yang memenuhi syarat secara acak.
- Duri terpilih bergerak maju ke arah hadapnya.
- Duri bergerak sampai cell kosong terakhir sebelum dinding, lalu hilang.
- Duri yang tidak terpilih tetap diam.
- Efek collision tetap sama: bola kehilangan 1 nyawa jika menyentuh duri bergerak.
- Jika shield aktif, bola tetap kebal terhadap duri bergerak.

### Duri Homing Level 21+

Pada level `21+`, sebagian duri bergerak mengejar bola hanya di mode Hard.

- Berlaku setiap fase duri muncul ke arena.
- Game memilih sekitar `10%` dari semua duri aktif secara acak.
- Duri terpilih bergerak mengejar posisi bola selama `7 detik`.
- Duri homing mengikuti jalur kosong maze dengan pathfinding grid.
- Duri homing tidak boleh menembus dinding.
- Duri homing memakai warna warning berbeda dari duri normal.
- Duri homing mengabaikan duri lain sebagai blocker agar tidak berhenti saat bertemu duri lain.
- Jika duri homing tersangkut, game menghitung ulang jalur dari cell kosong terdekat.
- Arah segitiga duri homing mengikuti arah gerakan aktual dengan rotasi halus saat berbelok.
- Setelah 7 detik, duri homing menghilang.
- Efek collision tetap sama: bola kehilangan 1 nyawa jika menyentuh duri homing.
- Jika shield aktif, bola tetap kebal terhadap duri homing.

### Boss Level

Boss Level aktif di mode Hard pada setiap level kelipatan `10`.

- Maze tetap normal.
- Hazard memakai pola khusus per wave.
- Wave boss berganti setiap fase duri spawn.
- Pola boss diatur dari `GAME_CONFIG.bossLevel.wavePatterns`.
- Easy tidak memakai Boss Level.

## Token Nyawa

Pada level kelipatan 7, muncul 1 token nyawa.

- Token muncul di cell jalan random.
- Token berbentuk hati merah.
- Token aktif selama `15 detik`.
- Jika diambil, `lives += 1`.
- Tidak ada batas maksimal nyawa tambahan.
- Token dibersihkan saat pindah level, restart, back home, atau game over.

## Token Shield

Mulai level 6, setiap level punya probabilitas `25%` untuk memunculkan token shield.

- Token shield muncul 1 kali pada level tersebut jika probabilitas berhasil.
- Token spawn di cell jalan random.
- Token memakai icon shield berwarna biru muda.
- Token aktif selama `15 detik`.
- Jika disentuh bola, token hilang dan shield aktif selama `10 detik`.
- Saat shield aktif, bola punya stroke biru muda di sekelilingnya.
- Saat shield aktif, bola kebal dari efek duri.
- Shield direset saat bola menyentuh Finish, walaupun durasinya belum habis.
- Token dan efek shield dibersihkan saat restart, back home, atau game over.

## High Score dan Progress

Storage yang digunakan:

- `mazeBallHighScoreEasy`: level tertinggi Easy.
- `mazeBallHighScoreHard`: level tertinggi Hard.
- `mazeBallHighScore`: legacy key yang dimigrasi ke Easy jika ada.
- `mazeBallProgress`: progress level, lives, dan difficulty saat game belum selesai.
- `mazeBallControlsVisible`: state show/hide joystick.
- `mazeBallDifficulty`: mode difficulty terakhir yang dipilih.
- `mazeBallTutorialSeen`: status tutorial first-time.

Progress:

- Disimpan saat game masih berjalan.
- Berisi `level`, `lives`, dan `difficulty`.
- Home menampilkan `Continue Easy/Hard Level X` jika progress ada.
- `Start Game` menghapus progress lama dan mulai dari level 1.
- Game Over menghapus progress.
- Continue membuat maze baru pada level tersimpan dengan nyawa dan difficulty tersimpan.

## Difficulty

Game punya dua mode difficulty saat memulai game baru:

- Easy: tidak ada duri bergerak atau homing.
- Easy: duri spawn setiap `5-10 detik`.
- Hard: memakai semua fitur duri seperti kondisi penuh saat ini.
- Hard: duri spawn setiap `3-7 detik`.
- Hard: level kelipatan `10` memakai Boss Level.
- Jika progress lama tidak punya data difficulty, Continue memakai default Easy.
- Header Game Page menampilkan flag mode aktif.

## Pause

Pause menu tersedia dari HUD.

- Resume melanjutkan game.
- Restart memulai run baru dari level 1.
- Back Home menyimpan progress lalu kembali ke Home.
- Pause menghentikan input hold, swipe repeat, game loop, dan timeout aktif.
- Timer duri, token, shield, dan transition dilanjutkan dari sisa durasi saat resume.

## Audio

Sound effect dibuat dengan Web Audio API.
Tidak ada file audio eksternal.

- Move sound: saat bola bergerak valid.
- Success sound: saat bola mencapai Finish.
- Fail sound: saat bola terkena duri atau nyawa habis.

## Rendering

Game dirender dengan `<canvas>`.
Semua posisi dihitung dari grid internal, bukan pixel mentah browser.
Canvas resize mengikuti ukuran container agar collision tetap akurat.

Debug mode bisa diaktifkan dengan query param `?debug=1`.
Saat aktif, canvas menampilkan grid line dan panel kecil berisi state runtime.

Debug testing flags:

- `level=NUMBER`: start game dari level tertentu.
- `difficulty=easy|hard`: paksa difficulty saat Start Game.
- `forceMoving=1`: paksa fitur moving spike aktif jika ada spike eligible.
- `forceHoming=1`: paksa sebagian spike menjadi homing.
- `forceLifeToken=1`: paksa life token spawn.
- `forceShieldToken=1`: paksa shield token spawn.
- `noSpike=1`: matikan spawn spike.
- `invincible=1`: bola kebal dari kehilangan nyawa akibat duri.

Objek yang dirender:

- Maze walls.
- Player ball.
- Player trail.
- Start icon.
- Finish icon.
- Spikes.
- Life token heart.
- Shield token.
- Pickup particles.

## Visual Effects

Config visual berada di `GAME_CONFIG.visual`.

- Level `1-10`: blue maze theme.
- Level `11-20`: orange hazard theme.
- Level `21+`: neon danger theme.
- Token memakai animasi spawn scale/opacity.
- Token berkedip dan fade saat mendekati waktu hilang.
- Pickup token memunculkan particle sesuai warna token.
- Shield aktif memakai stroke pulse di sekitar bola.
- Bola memiliki trail halus saat bergerak.
- Naik level memunculkan transition overlay singkat.

## Catatan Untuk AI Agent

- Jangan tambahkan framework atau library eksternal.
- Pertahankan single-page flow dengan section Home, Game, dan End.
- Jangan ubah grid size tanpa meninjau maze generation dan collision.
- Ubah angka balancing dari `GAME_CONFIG`, bukan dari magic number di tengah fungsi.
- Ubah key storage dari `STORAGE_KEYS`, bukan string literal langsung.
- Jika mengubah input, pastikan keyboard, joystick, dan swipe tetap berjalan.
- Jika mengubah state, pastikan `updateHUD()` dan `localStorage` tetap sinkron.
- Jika menambah timeout atau interval, masukkan cleanup ke `clearActiveRunState()` atau `clearLevelTimers()` sesuai lifecycle.
- Jalankan `node --check js/script.js` setelah mengubah JavaScript.
