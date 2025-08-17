// Helper to calculate correct CRC values for tests
function crc8OfString(input) {
  let crc = 0x00;
  for (let i = 0; i < input.length; i++) {
    const byte = input.charCodeAt(i) & 0xFF;
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
    }
  }
  return crc & 0xFF;
}

const testData = [
  'pt1:100,pt2:200',
  'V0_LS_OPEN:1,V0_LS_CLOSED:0,V1_LS_OPEN:0,V1_LS_CLOSED:1',
  'pt1:850.5,pt2:900.0,V0_LS_OPEN:1,tc1:25.5',
  'pt1:invalid,pt2:200',
  'pt1:100,invalid_field:bad_value,pt2:200'
];

testData.forEach(data => {
  const crc = crc8OfString(data);
  console.log(`"${data}" -> ${crc.toString(16).toUpperCase().padStart(2, '0')}`);
});