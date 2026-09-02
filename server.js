// SIT725 7.3P - Socket Programming
// Live Poll App: a host creates a poll (question + options), voters vote
// from their own page, and everyone watching (host + voters) sees the
// results update live, in real time, as votes come in.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Single active poll at a time (fine for a demo app)
let currentPoll = null; // { question, options: [{ text, votes }], isOpen }
const votedSocketIds = new Set(); // track who already voted on the current poll

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.emit('pollState', getPublicPollState());

  socket.on('createPoll', ({ question, options }) => {
    if (!question || !Array.isArray(options) || options.length < 2) return;

    currentPoll = {
      question: String(question).trim(),
      options: options
        .map((o) => String(o).trim())
        .filter(Boolean)
        .map((text) => ({ text, votes: 0 })),
      isOpen: true,
    };
    votedSocketIds.clear();

    io.emit('pollState', getPublicPollState());
  });

  socket.on('castVote', ({ optionIndex }) => {
    if (!currentPoll || !currentPoll.isOpen) return;
    if (votedSocketIds.has(socket.id)) return;
    if (optionIndex < 0 || optionIndex >= currentPoll.options.length) return;

    currentPoll.options[optionIndex].votes += 1;
    votedSocketIds.add(socket.id);

    io.emit('pollState', getPublicPollState());
    socket.emit('voteAccepted', { optionIndex });
  });

  socket.on('closePoll', () => {
    if (!currentPoll) return;
    currentPoll.isOpen = false;
    io.emit('pollState', getPublicPollState());
  });

  socket.on('disconnect', () => {
    votedSocketIds.delete(socket.id);
    console.log(`Client disconnected: ${socket.id}`);
  });
});

function getPublicPollState() {
  if (!currentPoll) return null;
  const totalVotes = currentPoll.options.reduce((sum, o) => sum + o.votes, 0);
  return {
    question: currentPoll.question,
    isOpen: currentPoll.isOpen,
    totalVotes,
    options: currentPoll.options.map((o) => ({
      text: o.text,
      votes: o.votes,
      percent: totalVotes === 0 ? 0 : Math.round((o.votes / totalVotes) * 100),
    })),
  };
}

server.listen(PORT, () => {
  console.log(`Live Poll App running on http://localhost:${PORT}`);
});