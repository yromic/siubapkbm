async function main() {
  try {
    const route = await import('../app/api/v1/rpm/[id]/attachments/[attachmentId]/download/route');
    console.log('Route exports:', Object.keys(route));
  } catch (err) {
    console.error('Import error:', err);
  }
}

main();
