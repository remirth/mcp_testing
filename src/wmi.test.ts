import $ from 'node:test';
import {queryWmi} from './wmi.ts';
import assert from 'node:assert';

await $.test('WMI', async () => {
  await $.describe('queryWmi', async () => {
    await $.it(
      'should be able to get a list of current processes',
      async () => {
        const list = await queryWmi(
          'SELECT Name, ProcessId FROM Win32_Process',
        );

        assert(Array.isArray(list), 'it should be a list');
        console.log('list length', list.length);
        assert(list.length, 'it should contain items');
      },
    );
  });
});
