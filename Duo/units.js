const units = [
  ["Hello", "Chào hỏi", 10, "👋", [
    ["hello","xin chào"],["bye","tạm biệt"],["fine","khỏe"],["thank you","cảm ơn"],["How are you?","Bạn khỏe không?"],["Hello, I'm Mai.","Xin chào, mình là Mai."]
  ], [
    ["Ben: Hi, Lucy! How are you?","Lucy: Fine, thank you.","Ben hỏi Lucy điều gì?","Bạn khỏe không?","Bạn tên gì?","Bạn bao nhiêu tuổi?"],
    ["Minh: Hello, I'm Minh.","Mai: Hi, Minh. I'm Mai.","Bạn nào chào Minh?","Mai","Lucy","Ben"]
  ]],
  ["Our names", "Tên và tuổi", 16, "🎂", [
    ["name","tên"],["seven","số 7"],["eight","số 8"],["nine","số 9"],["What's your name?","Bạn tên gì?"],["How old are you?","Bạn bao nhiêu tuổi?"],["I'm eight years old.","Mình tám tuổi."]
  ], [
    ["Linh: What's your name?","Bill: My name's Bill. I'm nine years old.","Bill bao nhiêu tuổi?","9 tuổi","7 tuổi","8 tuổi"],
    ["Mary: Hi! I'm Mary. What's your name?","Nam: My name's Nam.","Bạn nào trả lời Mary?","Nam","Bill","Linh"]
  ]],
  ["Our friends", "Bạn bè", 22, "🤝", [
    ["friend","bạn"],["teacher","giáo viên"],["this","đây / này"],["that","kia / đó"],["This is my friend.","Đây là bạn của mình."],["Is that Mr Long?","Kia có phải là thầy Long không?"]
  ], [
    ["Mai: Is that Mr Long?","Nam: No, it isn't. It's Ms Hoa.","Người mà Mai chỉ là ai?","Cô Hoa","Thầy Long","Bạn Nam"],
    ["Mai: Is this your friend?","Nam: Yes, it is. This is Bill.","Bạn của Nam tên gì?","Bill","Minh","Ben"]
  ]],
  ["Our bodies", "Cơ thể", 28, "👂", [
    ["ear","tai"],["eye","mắt"],["face","khuôn mặt"],["hair","tóc"],["hand","bàn tay"],["mouth","miệng"],["nose","mũi"],["Touch your nose.","Chạm vào mũi của em."],["Open your mouth.","Mở miệng ra."]
  ], [
    ["Teacher: Touch your nose!","Lucy: OK!","Lucy cần chạm vào đâu?","Mũi","Tai","Tóc"],
    ["Ben: What's this?","Mai: It's an ear.","Mai nói đó là bộ phận nào?","Tai","Mắt","Miệng"]
  ]],
  ["My hobbies", "Sở thích", 34, "🎨", [
    ["cooking","nấu ăn"],["dancing","nhảy múa"],["drawing","vẽ bằng bút"],["painting","vẽ bằng màu"],["running","chạy"],["singing","hát"],["swimming","bơi"],["walking","đi bộ"],["What's your hobby?","Sở thích của bạn là gì?"],["I like swimming.","Mình thích bơi."]
  ], [
    ["Bill: What's your hobby, Linh?","Linh: I like singing.","Linh thích làm gì?","Hát","Bơi","Chạy"],
    ["Mary: What's your hobby, Nam?","Nam: It's cooking. How about you?","Nam thích làm gì?","Nấu ăn","Đi bộ","Nhảy múa"]
  ]],
  ["Our school", "Trường học", 44, "🏫", [
    ["art room","phòng mỹ thuật"],["classroom","lớp học"],["computer room","phòng máy tính"],["gym","phòng thể dục"],["library","thư viện"],["music room","phòng âm nhạc"],["playground","sân chơi"],["school","trường học"],["Let's go to the library.","Mình cùng đến thư viện nhé."],["Is this our school?","Đây có phải là trường của chúng mình không?"]
  ], [
    ["Lucy: Is this our classroom?","Ben: No, it isn't. It's the art room.","Đây là phòng nào?","Phòng mỹ thuật","Lớp học","Phòng âm nhạc"],
    ["Mai: Let's go to the gym.","Minh: OK, let's go.","Hai bạn định đi đâu?","Phòng thể dục","Thư viện","Sân chơi"]
  ]],
  ["Classroom instructions", "Chỉ dẫn trong lớp", 50, "🙋", [
    ["close","đóng"],["come in","vào trong"],["go out","ra ngoài"],["sit down","ngồi xuống"],["speak","nói"],["stand up","đứng lên"],["May I come in?","Em xin phép vào được không?"],["Sit down, please.","Mời em ngồi xuống."]
  ], [
    ["Mai: May I go out?","Teacher: Yes, you can.","Mai xin phép làm gì?","Ra ngoài","Vào lớp","Ngồi xuống"],
    ["Teacher: Stand up, please.","Bill: OK!","Bill cần làm gì?","Đứng lên","Ngồi xuống","Đóng sách"]
  ]],
  ["My school things", "Đồ dùng học tập", 56, "✏️", [
    ["book","sách"],["eraser","cục tẩy"],["notebook","vở"],["pen","bút mực"],["pencil","bút chì"],["pencil case","hộp bút"],["ruler","thước kẻ"],["school bag","cặp sách"],["I have a ruler.","Mình có một cây thước."],["Do you have a pencil?","Bạn có bút chì không?"]
  ], [
    ["Nam: Do you have a pen?","Mary: No, I don't. I have a pencil.","Mary có đồ vật nào?","Bút chì","Bút mực","Thước kẻ"],
    ["Linh: Do you have an eraser?","Bill: Yes, I do.","Bill có đồ vật nào?","Cục tẩy","Sách","Cặp sách"]
  ]],
  ["Colours", "Màu sắc", 62, "🌈", [
    ["black","màu đen"],["blue","màu xanh dương"],["brown","màu nâu"],["green","màu xanh lá"],["orange","màu cam"],["red","màu đỏ"],["white","màu trắng"],["yellow","màu vàng"],["What colour is it?","Nó màu gì?"],["What colour are they?","Chúng màu gì?"]
  ], [
    ["Ben: What colour is your ruler?","Lucy: It's blue.","Thước của Lucy màu gì?","Màu xanh dương","Màu vàng","Màu đỏ"],
    ["Mai: What colour are your pencils?","Minh: They're green.","Bút chì của Minh màu gì?","Màu xanh lá","Màu đen","Màu trắng"]
  ]],
  ["Break time activities", "Hoạt động giờ ra chơi", 68, "⚽", [
    ["break time","giờ ra chơi"],["chat","trò chuyện"],["badminton","cầu lông"],["basketball","bóng rổ"],["chess","cờ vua"],["football","bóng đá"],["table tennis","bóng bàn"],["volleyball","bóng chuyền"],["word puzzles","trò đố chữ"],["I play football at break time.","Mình chơi bóng đá vào giờ ra chơi."],["What do you do at break time?","Bạn làm gì vào giờ ra chơi?"]
  ], [
    ["Linh: What do you do at break time?","Nam: I play chess.","Nam chơi gì vào giờ ra chơi?","Cờ vua","Bóng rổ","Bóng đá"],
    ["Mary: I play badminton at break time. How about you?","Bill: I play table tennis.","Bill chơi môn gì?","Bóng bàn","Cầu lông","Bóng chuyền"]
  ]]
];
