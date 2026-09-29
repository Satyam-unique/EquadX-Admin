import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  onSnapshot,
  collectionGroup,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ==============================
   Firebase Config
============================== */

const firebaseConfig = {
  apiKey: "API KEY HIDDEN",
  authDomain: "eqaudx.firebaseapp.com",
  projectId: "eqaudx"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);



/* ==============================
   Section Switcher
============================== */
window.showSection = function(id) {
  document.querySelectorAll(".section").forEach(sec =>
    sec.classList.add("hidden")
  );
  document.getElementById(id).classList.remove("hidden");
};



/* ==============================
   1️⃣ Dashboard Counts
============================== */

onSnapshot(collection(db, "users"), snap => {
  document.getElementById("userCount").innerText = snap.size;
});

onSnapshot(collection(db, "bins"), snap => {
  document.getElementById("binCount").innerText = snap.size;
});

onSnapshot(collectionGroup(db, "scans"), snap => {
  document.getElementById("scanCount").innerText = snap.size;
});



/* ==============================
   2️⃣ Live Scan Monitor
============================== */

onSnapshot(collectionGroup(db, "scans"), snap => {
  const list = document.getElementById("scanList");
  if (!list) return;

  list.innerHTML = "";

  snap.forEach(docSnap => {
    const data = docSnap.data();

    const li = document.createElement("li");
    li.innerHTML = `
      👤 <b>${data.userId || "Unknown"}</b>
      | 🗑 ${data.binId || "N/A"}
      | 📍 ${data.distance ? data.distance + "m" : "-"}
    `;
    list.appendChild(li);
  });
});



/* ==============================
   3️⃣ QR Generator + Save
============================== */

window.generateQR = async function() {

  const binId = document.getElementById("qrInput").value.trim();
  const lat = parseFloat(document.getElementById("latInput").value);
  const lng = parseFloat(document.getElementById("lngInput").value);
  const points = parseInt(document.getElementById("pointsInput").value) || 10;

  if (!binId) return alert("Enter BIN ID");
  if (isNaN(lat) || isNaN(lng)) return alert("Enter valid latitude & longitude");

  const qrText = "EQUADX_BIN:" + binId;

  try {

    await setDoc(doc(db, "bins", binId), {
      active: true,
      lat,
      lng,
      points,
      qrText,
      updatedAt: serverTimestamp()
    }, { merge: true });

    QRCode.toCanvas(document.getElementById("qrCanvas"), qrText);

    alert("Bin created successfully!");

  } catch (error) {
    console.error(error);
    alert("Error saving bin");
  }
};



/* ==============================
   4️⃣ Fast MapLibre Map
============================== */

let map;
let markers = [];

window.initMap = function () {

  map = new maplibregl.Map({
    container: 'mapContainer',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center: [83.431353, 26.731391],
    zoom: 13
  });

  map.addControl(new maplibregl.NavigationControl());

  onSnapshot(collection(db, "bins"), snap => {

    markers.forEach(m => m.remove());
    markers = [];

    snap.forEach(docSnap => {
      const data = docSnap.data();

      if (typeof data.lat !== "number" || typeof data.lng !== "number") return;

      const el = document.createElement('div');
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = data.active ? "green" : "red";
      el.style.border = "2px solid white";

      const marker = new maplibregl.Marker(el)
        .setLngLat([data.lng, data.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 })
            .setHTML(`
              <b>${docSnap.id}</b><br>
              Points: ${data.points || 0}<br>
              Active: ${data.active}
            `)
        )
        .addTo(map);

      markers.push(marker);
    });
  });
};

document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("mapContainer")) {
    initMap();
  }
});



/* ==============================
   5️⃣ Analytics
============================== */

let chartInstance = null;

onSnapshot(collectionGroup(db, "scans"), snap => {

  const ctx = document.getElementById("chartCanvas");
  if (!ctx) return;

  const counts = {};

  snap.forEach(docSnap => {
    const bin = docSnap.data().binId;
    if (!bin) return;
    counts[bin] = (counts[bin] || 0) + 1;
  });

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(counts),
      datasets: [{
        label: "Scans per Bin",
        data: Object.values(counts),
      }]
    }
  });
});



/* ==============================
   6️⃣ Suspicious Detection
============================== */

onSnapshot(collectionGroup(db, "scans"), snap => {

  const fraudList = document.getElementById("fraudList");
  if (!fraudList) return;

  fraudList.innerHTML = "";

  snap.forEach(docSnap => {
    const data = docSnap.data();

    if (data.distance && data.distance < 5) {
      const li = document.createElement("li");
      li.innerHTML = `
        ⚠ <b>${data.userId}</b> scanned 
        ${data.binId} (${data.distance}m)
      `;
      fraudList.appendChild(li);
    }
  });
});



/* ==============================
   7️⃣ Manage Bins (Edit + Toggle + View QR)
============================== */

onSnapshot(collection(db, "bins"), snap => {

  const table = document.getElementById("binsTable");
  if (!table) return;

  table.innerHTML = "";

  snap.forEach(docSnap => {

    const data = docSnap.data();
    const binId = docSnap.id;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td><b>${binId}</b></td>

      <td>
        <input type="number"
          value="${data.points || 0}"
          id="points-${binId}"
          style="width:70px;">
      </td>

      <td>
        <span style="color:${data.active ? 'green' : 'red'}; font-weight:bold;">
          ${data.active ? "Active" : "Inactive"}
        </span>
        <br>
        <button onclick="toggleBin('${binId}', ${data.active})">
          ${data.active ? "Deactivate" : "Activate"}
        </button>
      </td>

      <td>
        <button onclick="showQR('${data.qrText || ""}')">
          View QR
        </button>
      </td>

      <td>
        <button onclick="updatePoints('${binId}')">
          Save
        </button>
      </td>
    `;

    table.appendChild(row);
  });
});



window.toggleBin = async function(binId, currentStatus) {
  await updateDoc(doc(db, "bins", binId), {
    active: !currentStatus
  });
};


window.updatePoints = async function(binId) {

  const newPoints = parseInt(
    document.getElementById("points-" + binId).value
  );

  if (isNaN(newPoints)) return alert("Enter valid points");

  await updateDoc(doc(db, "bins", binId), {
    points: newPoints
  });

  alert("Points updated!");
};



/* ==============================
   QR Modal Logic
============================== */

let currentQRText = "";

window.showQR = function(qrText) {

  if (!qrText) return alert("QR not available");

  currentQRText = qrText;

  QRCode.toCanvas(
    document.getElementById("modalQR"),
    qrText
  );

  document.getElementById("qrModal")
    .classList.remove("hidden");
};

window.closeQR = function() {
  document.getElementById("qrModal")
    .classList.add("hidden");
};

window.downloadQR = function() {

  const canvas = document.getElementById("modalQR");
  const link = document.createElement("a");

  link.download = currentQRText + ".png";
  link.href = canvas.toDataURL();

  link.click();
};



/* ==============================
   Logout
============================== */

window.logout = function() {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
};

/* ==============================
   8️⃣ Users Section (Admins First + Role Change)
============================== */

onSnapshot(collection(db, "users"), snap => {

  const table = document.getElementById("usersTable");
  if (!table) return;

  table.innerHTML = "";

  const users = [];

  snap.forEach(docSnap => {
    users.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  // 🔥 Sort: Admins first
  users.sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    return 0;
  });

  users.forEach(user => {

    const row = document.createElement("tr");

    // Highlight admin row
    if (user.role === "admin") {
      row.classList.add("admin-row");
    }

    row.innerHTML = `
      <td>
        ${user.fullName || "No Name"}
        ${user.role === "admin" ? 
          '<span class="admin-badge">ADMIN</span>' 
          : ''}
      </td>

      <td>${user.email || "-"}</td>

      <td>${user.points || 0}</td>

      <td>
        <select onchange="changeRole('${user.id}', this.value)">
          <option value="student" ${user.role === "student" ? "selected" : ""}>
            Student
          </option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>
            Admin
          </option>
        </select>
      </td>
    `;

    table.appendChild(row);
  });

});


// 🔥 Change Role Function
window.changeRole = async function(userId, newRole) {

  try {
    await updateDoc(doc(db, "users", userId), {
      role: newRole
    });

    alert("Role updated successfully!");

  } catch (error) {
    console.error(error);
    alert("Error updating role");
  }

};