import 'dotenv/config';
import { Connection } from '@temporalio/client';
const namespace = process.env.TEMPORAL_NAMESPACE || 'agency-workspace';
const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || 'localhost:7233' });
try {
  await connection.workflowService.describeNamespace({ namespace });
} catch (error) {
  if (error.code !== 5) throw error;
  await connection.workflowService.registerNamespace({ namespace, workflowExecutionRetentionPeriod: { seconds: 30 * 86400 } });
}
let attributes;
for (let attempt = 0; attempt < 30; attempt++) {
  try { attributes = await connection.operatorService.listSearchAttributes({ namespace }); break; }
  catch (error) { if (error.code !== 5 || attempt === 29) throw error; await new Promise(resolve => setTimeout(resolve, 1000)); }
}
const missing = Object.fromEntries(['organizationId', 'postId'].filter(name => !attributes.customAttributes[name]).map(name => [name, 1]));
if (Object.keys(missing).length) await connection.operatorService.addSearchAttributes({ namespace, searchAttributes: missing });
console.log(`Temporal namespace ${namespace} is ready`);
await connection.close();
