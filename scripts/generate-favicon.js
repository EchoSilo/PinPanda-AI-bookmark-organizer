const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateFavicon() {
  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync(path.join(__dirname, '../app/favicon.svg'));
    
    // Convert SVG to PNG at different sizes
    const sizes = [16, 32, 48];
    
    // Create public directory if it doesn't exist
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // Generate PNGs at different sizes
    for (const size of sizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(__dirname, `../public/favicon-${size}.png`));
    }
    
    // For ICO file, we'll use the 32x32 size as it's the most common
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.join(__dirname, '../public/favicon.ico'));
    
    // Also save the SVG to public folder
    fs.copyFileSync(
      path.join(__dirname, '../app/favicon.svg'),
      path.join(__dirname, '../public/favicon.svg')
    );
    
    console.log('Successfully generated favicon files in public directory');
  } catch (error) {
    console.error('Error generating favicon:', error);
  }
}

generateFavicon(); 