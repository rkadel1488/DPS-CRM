const fs = require('fs');

let content = fs.readFileSync('src/components/GatePassDashboard.tsx', 'utf8');

const targetScanner = `try {
          // Try environment (back) camera first
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {`;

const replacementScanner = `try {
          const savedCameraId = localStorage.getItem('preferredQrCameraId');
          // Try saved camera or environment (back) camera first
          await html5QrCode.start(
            savedCameraId ? savedCameraId : { facingMode: "environment" },
            config,
            (decodedText) => {`;
            
const targetFallback = `const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0 && isMounted) {
            await html5QrCode.start(
              cameras[0].id,
              config,
              (decodedText) => {`;
              
const replacementFallback = `const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0 && isMounted) {
            const defaultCamera = cameras.find(c => c.label.toLowerCase().includes('back')) || cameras[0];
            localStorage.setItem('preferredQrCameraId', defaultCamera.id);
            await html5QrCode.start(
              defaultCamera.id,
              config,
              (decodedText) => {`;
              
content = content.replace(targetScanner, replacementScanner);
content = content.replace(targetFallback, replacementFallback);

fs.writeFileSync('src/components/GatePassDashboard.tsx', content);
console.log("updated script");
