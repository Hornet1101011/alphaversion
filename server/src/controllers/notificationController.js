const Notification = require('../../models/Notification');

exports.createNotification = async (req, res) => {
  try {
    const { userId, type, message } = req.body;
    const notification = await Notification.create({ userId, type, message });
    res.status(201).json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
