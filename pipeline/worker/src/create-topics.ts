// `npm run topics`: creates any missing pipeline topics, then lists them with their
// partition counts.
import { createAdmin, ensureTopics } from "./kafka";
import { TOPIC_SPECS } from "./topics";

const admin = createAdmin("openwatch-topics");

try {
  const created = await ensureTopics(admin);
  console.log(created.length ? `Created: ${created.join(", ")}` : "All topics already exist.");

  const names = TOPIC_SPECS.map(({ name }) => name);
  const metadata = await admin.metadata({ topics: names });
  for (const name of names) {
    const topic = metadata.topics.get(name);
    console.log(`  ${name.padEnd(16)} ${topic ? `${topic.partitionsCount} partitions` : "missing"}`);
  }
} finally {
  await admin.close();
}
