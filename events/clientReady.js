const statuses = require('../utils/statuses');

const ROTATE_INTERVAL_MS = 10000; // 10 seconds

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    let statusIndex = 0;

    function setNextStatus() {
      const status = statuses[statusIndex];
      client.user.setPresence({
        activities: [{ name: status.name, type: status.type }],
        status: 'online',
      });
      statusIndex = (statusIndex + 1) % statuses.length;
    }

    setNextStatus();
    setInterval(setNextStatus, ROTATE_INTERVAL_MS);
  },
};