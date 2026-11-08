const units = [
  ["Hello", "Chào hỏi", 10, "👋", [
    ["hello","xin chào"],["bye","tạm biệt"],["fine","khỏe"],["thank you","cảm ơn"],
    ["How are you?","Bạn khỏe không?"],["Hello, I'm Mai.","Xin chào, mình là Mai."],["I","tôi / mình"],["goodbye","chào tạm biệt"],
    ["how","như thế nào"],["you","bạn (người đang nghe)"],["Hi, I'm Ben.","Chào bạn, mình là Ben."],["I'm fine, thank you.","Mình khỏe, cảm ơn bạn."],
    ["Hello, how are you?","Xin chào, bạn khỏe không?"],["Goodbye, my friend.","Tạm biệt bạn của mình."]
  ], [
    ["Ben: Hi, Lucy! How are you?","Lucy: Fine, thank you.","Ben hỏi Lucy điều gì?","Bạn khỏe không?","Bạn tên gì?","Bạn bao nhiêu tuổi?"],
    ["Minh: Hello, I'm Minh.","Mai: Hi, Minh. I'm Mai.","Bạn nào chào Minh?","Mai","Lucy","Ben"],
    ["Lucy: Hi, Ben! How are you?","Ben: I'm fine, thank you.","Ben trả lời thế nào?","Mình khỏe, cảm ơn bạn.","Mình tên là Ben.","Tạm biệt bạn."],
    ["Mai: Goodbye, Minh!","Minh: Bye, Mai! See you!","Hai bạn đang làm gì?","Chào tạm biệt","Hỏi tên","Hỏi tuổi"]
  ]],
  ["Our names", "Tên và tuổi", 16, "🎂", [
    ["name","tên"],["seven","số 7"],["eight","số 8"],["nine","số 9"],
    ["What's your name?","Bạn tên gì?"],["How old are you?","Bạn bao nhiêu tuổi?"],["I'm eight years old.","Mình tám tuổi."],["my","của mình"],
    ["your","của bạn"],["old","lớn tuổi"],["ten","số 10"],["six","số 6"],
    ["My name's Lucy.","Tên mình là Lucy."],["I'm seven years old.","Mình bảy tuổi."],["I'm ten years old.","Mình mười tuổi."]
  ], [
    ["Linh: What's your name?","Bill: My name's Bill. I'm nine years old.","Bill bao nhiêu tuổi?","9 tuổi","7 tuổi","8 tuổi"],
    ["Mary: Hi! I'm Mary. What's your name?","Nam: My name's Nam.","Bạn nào trả lời Mary?","Nam","Bill","Linh"],
    ["Nam: How old are you, Linh?","Linh: I'm seven years old.","Linh bao nhiêu tuổi?","7 tuổi","6 tuổi","10 tuổi"],
    ["Bill: What's your name?","Lucy: My name's Lucy. I'm eight years old.","Lucy bao nhiêu tuổi?","8 tuổi","9 tuổi","10 tuổi"]
  ]],
  ["Our friends", "Bạn bè", 22, "🤝", [
    ["friend","bạn"],["teacher","giáo viên"],["this","đây / này"],["that","kia / đó"],
    ["This is my friend.","Đây là bạn của mình."],["Is that Mr Long?","Kia có phải là thầy Long không?"],["Mr","ông / thầy (trước tên)"],["Ms","bà / cô (trước tên)"],
    ["yes","vâng / có"],["no","không"],["This is my teacher.","Đây là giáo viên của mình."],["That is my friend.","Kia là bạn của mình."],
    ["Is this your teacher?","Đây có phải là giáo viên của bạn không?"]
  ], [
    ["Mai: Is that Mr Long?","Nam: No, it isn't. It's Ms Hoa.","Người mà Mai chỉ là ai?","Cô Hoa","Thầy Long","Bạn Nam"],
    ["Mai: Is this your friend?","Nam: Yes, it is. This is Bill.","Bạn của Nam tên gì?","Bill","Minh","Ben"],
    ["Linh: Is this your teacher?","Nam: Yes, it is. This is Ms Hoa.","Cô Hoa là ai?","Giáo viên của Nam","Bạn của Nam","Giáo viên của Linh"],
    ["Ben: That is my friend, Lucy.","Lucy: Hello! Nice to meet you.","Ben giới thiệu bạn nào?","Lucy","Mai","Linh"]
  ]],
  ["Our bodies", "Cơ thể", 28, "👂", [
    ["ear","tai"],["eye","mắt"],["face","khuôn mặt"],["hair","tóc"],
    ["hand","bàn tay"],["mouth","miệng"],["nose","mũi"],["Touch your nose.","Chạm vào mũi của em."],
    ["Open your mouth.","Mở miệng ra."],["arm","cánh tay"],["Touch your ears.","Chạm vào hai tai của em."],["Open your eyes.","Mở mắt ra."],
    ["This is my hand.","Đây là bàn tay của mình."],["It's an eye.","Đó là một con mắt."]
  ], [
    ["Teacher: Touch your nose!","Lucy: OK!","Lucy cần chạm vào đâu?","Mũi","Tai","Tóc"],
    ["Ben: What's this?","Mai: It's an ear.","Mai nói đó là bộ phận nào?","Tai","Mắt","Miệng"],
    ["Teacher: Open your eyes, please.","Minh: Yes, I can see now!","Minh được yêu cầu làm gì?","Mở mắt","Mở miệng","Chạm vào tai"],
    ["Lucy: What's this, Ben?","Ben: It's my hand.","Ben nói về bộ phận nào?","Bàn tay","Mũi","Cánh tay"]
  ]],
  ["My hobbies", "Sở thích", 34, "🎨", [
    ["cooking","nấu ăn"],["dancing","nhảy múa"],["drawing","vẽ bằng bút"],["painting","vẽ bằng màu"],
    ["running","chạy"],["singing","hát"],["swimming","bơi"],["walking","đi bộ"],
    ["What's your hobby?","Sở thích của bạn là gì?"],["I like swimming.","Mình thích bơi."],["I like drawing.","Mình thích vẽ bằng bút."],["I like dancing.","Mình thích nhảy múa."],
    ["I like walking.","Mình thích đi bộ."],["My hobby is painting.","Sở thích của mình là vẽ bằng màu."]
  ], [
    ["Bill: What's your hobby, Linh?","Linh: I like singing.","Linh thích làm gì?","Hát","Bơi","Chạy"],
    ["Mary: What's your hobby, Nam?","Nam: It's cooking. How about you?","Nam thích làm gì?","Nấu ăn","Đi bộ","Nhảy múa"],
    ["Mai: I like walking. What's your hobby?","Lucy: I like dancing.","Mai thích làm gì?","Đi bộ","Nhảy múa","Vẽ"],
    ["Ben: My hobby is painting. What about you?","Minh: My hobby is running.","Minh thích làm gì?","Chạy","Vẽ bằng màu","Nấu ăn"]
  ]],
  ["Our school", "Trường học", 44, "🏫", [
    ["art room","phòng mỹ thuật"],["classroom","lớp học"],["computer room","phòng máy tính"],["gym","phòng thể dục"],
    ["library","thư viện"],["music room","phòng âm nhạc"],["playground","sân chơi"],["school","trường học"],
    ["Let's go to the library.","Mình cùng đến thư viện nhé."],["Is this our school?","Đây có phải là trường của chúng mình không?"],["Let's go to the music room.","Mình cùng đến phòng âm nhạc nhé."],["Is this our gym?","Đây có phải là phòng thể dục của chúng mình không?"],
    ["This is our playground.","Đây là sân chơi của chúng mình."],["Let's go to the classroom.","Mình cùng đến lớp nhé."]
  ], [
    ["Lucy: Is this our classroom?","Ben: No, it isn't. It's the art room.","Đây là phòng nào?","Phòng mỹ thuật","Lớp học","Phòng âm nhạc"],
    ["Mai: Let's go to the gym.","Minh: OK, let's go.","Hai bạn định đi đâu?","Phòng thể dục","Thư viện","Sân chơi"],
    ["Ben: Let's go to the computer room.","Lucy: Yes, let's go together.","Hai bạn sẽ đến đâu?","Phòng máy tính","Phòng âm nhạc","Thư viện"],
    ["Mai: Is this our playground?","Minh: No, it isn't. This is our gym.","Mai và Minh đang ở đâu?","Phòng thể dục","Sân chơi","Lớp học"]
  ]],
  ["Classroom instructions", "Chỉ dẫn trong lớp", 50, "🙋", [
    ["close","đóng"],["come in","vào trong"],["go out","ra ngoài"],["sit down","ngồi xuống"],
    ["speak","nói"],["stand up","đứng lên"],["May I come in?","Em xin phép vào được không?"],["Sit down, please.","Mời em ngồi xuống."],
    ["open","mở"],["please","vui lòng"],["Open your book, please.","Em vui lòng mở sách."],["May I speak?","Em xin phép nói được không?"],
    ["Close your book, please.","Em vui lòng đóng sách."],["May I sit down?","Em xin phép ngồi xuống được không?"]
  ], [
    ["Mai: May I go out?","Teacher: Yes, you can.","Mai xin phép làm gì?","Ra ngoài","Vào lớp","Ngồi xuống"],
    ["Teacher: Stand up, please.","Bill: OK!","Bill cần làm gì?","Đứng lên","Ngồi xuống","Đóng sách"],
    ["Teacher: Close your book, please.","Linh: OK. May I go out?","Giáo viên yêu cầu Linh làm gì?","Đóng sách","Mở sách","Ra ngoài"],
    ["Nam: May I come in?","Teacher: Yes, you can come in.","Nam được phép làm gì?","Vào lớp","Ra ngoài","Đứng lên"]
  ]],
  ["My school things", "Đồ dùng học tập", 56, "✏️", [
    ["book","sách"],["eraser","cục tẩy"],["notebook","vở"],["pen","bút mực"],
    ["pencil","bút chì"],["pencil case","hộp bút"],["ruler","thước kẻ"],["school bag","cặp sách"],
    ["I have a ruler.","Mình có một cây thước."],["Do you have a pencil?","Bạn có bút chì không?"],["I have a notebook.","Mình có một quyển vở."],["Do you have a school bag?","Bạn có cặp sách không?"],
    ["I have a pencil case.","Mình có một hộp bút."],["Do you have a book?","Bạn có sách không?"]
  ], [
    ["Nam: Do you have a pen?","Mary: No, I don't. I have a pencil.","Mary có đồ vật nào?","Bút chì","Bút mực","Thước kẻ"],
    ["Linh: Do you have an eraser?","Bill: Yes, I do.","Bill có đồ vật nào?","Cục tẩy","Sách","Cặp sách"],
    ["Mai: Do you have a notebook?","Minh: Yes, I do. I have a pen, too.","Ngoài vở, Minh còn có gì?","Bút mực","Bút chì","Hộp bút"],
    ["Lucy: I have a school bag. Do you have one?","Ben: No, I don't. I have a ruler.","Ben có gì?","Thước kẻ","Cặp sách","Cục tẩy"]
  ]],
  ["Colours", "Màu sắc", 62, "🌈", [
    ["black","màu đen"],["blue","màu xanh dương"],["brown","màu nâu"],["green","màu xanh lá"],
    ["orange","màu cam"],["red","màu đỏ"],["white","màu trắng"],["yellow","màu vàng"],
    ["What colour is it?","Nó màu gì?"],["What colour are they?","Chúng màu gì?"],["My notebook is yellow.","Quyển vở của mình màu vàng."],["They are red.","Chúng có màu đỏ."],
    ["It's a brown school bag.","Đó là một chiếc cặp màu nâu."],["My pencils are orange.","Các bút chì của mình có màu cam."]
  ], [
    ["Ben: What colour is your ruler?","Lucy: It's blue.","Thước của Lucy màu gì?","Màu xanh dương","Màu vàng","Màu đỏ"],
    ["Mai: What colour are your pencils?","Minh: They're green.","Bút chì của Minh màu gì?","Màu xanh lá","Màu đen","Màu trắng"],
    ["Linh: What colour is your notebook?","Nam: My notebook is yellow.","Vở của Nam màu gì?","Màu vàng","Màu cam","Màu nâu"],
    ["Mary: What colour are your pens?","Bill: They are red.","Các cây bút của Bill màu gì?","Màu đỏ","Màu xanh lá","Màu trắng"]
  ]],
  ["Break time activities", "Hoạt động giờ ra chơi", 68, "⚽", [
    ["break time","giờ ra chơi"],["chat","trò chuyện"],["badminton","cầu lông"],["basketball","bóng rổ"],
    ["chess","cờ vua"],["football","bóng đá"],["table tennis","bóng bàn"],["volleyball","bóng chuyền"],
    ["word puzzles","trò đố chữ"],["I play football at break time.","Mình chơi bóng đá vào giờ ra chơi."],["What do you do at break time?","Bạn làm gì vào giờ ra chơi?"],["I play volleyball at break time.","Mình chơi bóng chuyền vào giờ ra chơi."],
    ["I chat with my friends.","Mình trò chuyện với các bạn."],["I solve word puzzles.","Mình chơi trò đố chữ."],["I play basketball at break time.","Mình chơi bóng rổ vào giờ ra chơi."]
  ], [
    ["Linh: What do you do at break time?","Nam: I play chess.","Nam chơi gì vào giờ ra chơi?","Cờ vua","Bóng rổ","Bóng đá"],
    ["Mary: I play badminton at break time. How about you?","Bill: I play table tennis.","Bill chơi môn gì?","Bóng bàn","Cầu lông","Bóng chuyền"],
    ["Mai: I play volleyball at break time. How about you?","Minh: I play basketball at break time.","Minh chơi gì vào giờ ra chơi?","Bóng rổ","Bóng chuyền","Cầu lông"],
    ["Lucy: What do you do at break time?","Ben: I chat with my friends.","Ben làm gì vào giờ ra chơi?","Trò chuyện với bạn bè","Chơi cờ vua","Chơi bóng đá"]
  ]]
];
