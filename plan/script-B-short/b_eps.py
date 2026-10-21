# B안 · 짧은 버전. 각 편: 남길 A안 줄 번호(0부터) + 필요하면 새 문장 {번호: (ko, es)}
# 규칙: 멈춤 6~7번, 한 번에 2문장까지, 스페인어 멘트 45초 안쪽. 원본 15초 넘으면 멈춤 앞 2.5초씩만 재생.
B = {
"001": ([0,1,2,3,4,5,7], {}),
"002": ([0,1,2,3,4,5,7], {}),
"003": ([0,1,2,3,4,5,7], {
  5: ("마지막엔 '5종 세트 링크 걸어둘게요'로 끝내요. 세트는 하나만 팔아도 많이 남거든요.",
      "Termina con 'te dejo el link del set de cinco'. Un set te deja mucho más que productos sueltos.")}),
"004": ([0,1,2,3,4,5,7], {
  3: ("셋째, 마지막에 '지난주엔 스페인 전역에서 품절됐었어요'라고 해요. 지금 안 사면 늦을 것 같죠.",
      "Tres: al final dice 'la semana pasada se agotó en toda España'. Sientes que si no compras ya, llegas tarde."),
  5: ("이 세럼은 미국 틱톡샵 첫 달에만 156만 달러어치가 팔렸어요. 뜨는 신제품을 먼저 잡으면 그만큼 팔 기회가 커져요.",
      "Este sérum vendió 1,56 millones de dólares en su primer mes en TikTok Shop. Llegar primero a un lanzamiento así es tu oportunidad.")}),
"005": ([0,1,2,3,4,5,7], {
  1: ("첫째, '이랬던 피부가… 이렇게 됐다'로 전후를 거꾸로 보여줘요. 좋아질 줄 알았는데 반대니까 멈추게 되죠.",
      "Uno: con 'pasar de esto… a esto' muestra el antes y después al revés. Esperas una mejora, pasa lo contrario, y te detienes.")}),
"006": ([0,1,2,3,4,5,7], {
  3: ("셋째, 댓글이 414개나 달렸어요. 서로 '나도 그랬어', '잘못 쓴 거야' 하는 동안 조회수가 계속 올라가요.",
      "Tres: tiene 414 comentarios. Mientras discuten entre 'a mí también' y 'lo usaste mal', las vistas siguen subiendo.")}),
"007": ([0,1,2,3,4,5,7], {}),
"008": ([0,1,2,3,4,5,7], {}),
"009": ([0,1,2,3,4,5,7], {}),
"010": ([0,1,2,3,4,5,7], {}),
"011": ([0,1,2,3,4,5,7], {}),
"012": ([0,1,2,3,4,5,7], {
  3: ("셋째, '지금 얼굴 만지면서 보고 있죠? 안 돼요!' 하고 콕 집어요. 뜨끔해서 끝까지 보고, 팁이 세 개라 저장까지 해요.",
      "Tres: '¿lo estás viendo tocándote la cara? ¡No!' Te señala directo. Te quedas, y con tres tips, lo guardas.")}),
# 013–026: HOOK + 포인트 3개 + 팁 + CTA
"013": ([0,1,2,3,4,5], {
  3: ("셋째, 이 영상은 좋아요 대비 저장이 65%예요. 남미 영상 272개 중에서도 상위 10% 안에 들어요.",
      "Tres: sus guardados son el 65% de sus likes. Entre 272 videos de LATAM, está en el 10% superior.")}),
"014": ([0,1,3,4,5,6], {
  3: ("셋째, 이 계정은 영상마다 좋아요가 평균 3만 개쯤 나와요. 이 영상도 3만 3천 개, 딱 평소만큼이에요.",
      "Tres: esta cuenta tiene unos 30 mil likes por video. Este tuvo 33 mil: justo su promedio."),
  4: ("넷째, 그러니까 '이렇게 찍으면 터진다'는 예시가 아니에요. 팔로워 77만이 만든 숫자예요.",
      "Cuatro: así que no es un ejemplo de 'grábalo así y explota'. Ese número lo dan sus 770 mil seguidores."),
  5: ("레퍼런스는 그 계정 평소 숫자랑 먼저 비교해 보세요. 평소보다 10배 넘게 나온 영상만 따라 할 가치가 있어요.",
      "Compara cada referencia con el promedio de esa cuenta. Solo vale copiar lo que hizo más de 10 veces su promedio.")}),
"015": ([0,1,2,4,5,6], {
  1: ("첫째, 맨 위에 피부 고민 사진 다섯 장을 깔아요. 사람들은 제품보다 내 피부랑 닮은 사진부터 찾아요.",
      "Uno: arriba pone cinco fotos de problemas de piel. La gente busca primero la que se parece a su piel."),
  2: ("둘째, 사진마다 화살표로 세럼을 하나씩 이어줘요. 이 표 한 장이면 고를 게 정해져요.",
      "Dos: una flecha une cada foto con un sérum. Con esta tabla, ya sabes cuál elegir."),
  4: ("셋째, 좋아요 대비 저장이 67%예요. 남미 영상 중간값 36%의 거의 두 배죠.",
      "Tres: sus guardados son el 67% de sus likes. Casi el doble de la mediana en LATAM, que es 36%."),
  5: ("고민별로 골라야 하는 제품이면 표 한 장으로 만들어 보세요. 다시 볼 이유가 있어야 저장을 눌러요.",
      "Si el producto se elige según el problema, haz una tabla. La gente guarda cuando tiene una razón para volver.")}),
"016": ([0,1,2,4,5,6], {
  1: ("첫째, 성분을 숫자로 화면에 박아요. 나이아신아마이드 4%, 트라넥삼산 2%.",
      "Uno: pone los ingredientes con números en pantalla. Niacinamida 4%, ácido tranexámico 2%."),
  2: ("둘째, 앰플 속 하얀 캡슐을 크게 보여줘요. 처음 보는 모양이라 손이 멈춰요.",
      "Dos: muestra de cerca las cápsulas blancas de la ampolla. Nunca las habías visto, y te detienes."),
  4: ("셋째, '한 달쯤 쓰면 보여요'라고 기간을 정해줘요. 그래서 과장 광고처럼 안 들려요.",
      "Tres: dice 'en un mes se nota'. Por eso no suena a publicidad exagerada.")}),
"017": ([0,1,2,6,7,8], {
  0: ("56초짜리인데 880만 뷰가 나왔어요. 길어도 끝까지 보게 만든 장치가 있어요.",
      "Dura 56 segundos y tiene 8,8 millones de vistas. Tiene un truco para que lo veas completo."),
  1: ("첫째, 첫마디가 '지성에 여드름 잘 나는 피부라면'이에요. 해당하는 사람만 남기니까 끝까지 봐요.",
      "Uno: empieza con 'si tienes piel grasa con tendencia al acné'. Solo se quedan a quienes les toca, y lo ven completo."),
  2: ("둘째, '그 바이럴 세럼 만든 브랜드'라고 소개해요. 처음 보는 선크림을 아는 제품 옆에 붙인 거죠.",
      "Dos: lo presenta como 'de la marca del sérum viral'. Pega un protector nuevo a algo que ya conoces."),
  6: ("셋째, 할 말이 많았지만 1분 안에서 끊었어요. 제가 모은 영상에선 1분 안쪽이 3.4배 더 많이 봤거든요.",
      "Tres: tenía mucho que decir, pero cortó antes del minuto. En los videos que reuní, los de menos de un minuto tuvieron 3,4 veces más vistas."),
  7: ("길게 설명할 제품이면 첫 문장에서 대상을 좁히고, 1분 안에서 끊으세요.",
      "Si el producto necesita explicación, acota el público en la primera frase y corta antes del minuto.")}),
"018": ([0,1,2,4,5,6], {
  4: ("셋째, 마지막은 다들 아는 닥터알티아 345 크림으로 닫아요. 아는 제품이 하나 있으면 나머지도 믿게 돼요.",
      "Tres: cierra con la crema 345 de Dr.Althea, que todos conocen. Si hay uno conocido, le crees al resto."),
  5: ("협찬 제품은 '좋은 제품' 말고 '돈 쓸 가치 있는 제품'이라고 말해보세요. 끝에 어디서 사는지 한 줄이면 돼요.",
      "En un patrocinio, no digas 'es bueno', di 'vale la pena'. Y al final, en una línea, dónde comprarlo.")}),
"019": ([0,2,3,4,5,6], {
  2: ("첫째, 다들 진정 크림으로만 아는 345 크림에서 '자국까지 옅어진다'는 새 얘기를 꺼내요. 아는 제품의 새 얘기엔 경쟁자가 거의 없어요.",
      "Uno: todos conocen la crema 345 como calmante; ella cuenta que también aclara las marcas. Algo nuevo de un producto conocido casi no tiene competencia."),
  3: ("둘째, 피부관리사라고 밝히고 성분을 짚어요. 자격이 있으니 광고처럼 안 들려요.",
      "Dos: dice que es cosmetóloga y explica los ingredientes. Con esa credencial, no suena a anuncio."),
  4: ("셋째, 근데 저장은 좋아요의 31%로 평균보다 낮아요. 다시 볼 정보가 부족했던 거예요.",
      "Tres: pero sus guardados son solo el 31% de sus likes, menos que el promedio. Le faltó algo para volver a verlo."),
  5: ("아는 제품도 새 얘기 하나면 다시 터져요. 저장까지 받으려면 성분표나 사용 순서를 붙이세요.",
      "Un producto conocido explota otra vez con una historia nueva. Para tener guardados, agrega la tabla de ingredientes o el orden de uso.")}),
"020": ([0,1,2,4,5,6], {
  2: ("둘째, 1년 넘게 추천해 온 선크림을 케이팝 아이돌도 쓰는 영상을 띄워요. 자기 말이 맞았다는 걸 아이돌이 보여줘요.",
      "Dos: muestra a un idol de K-pop usando el protector que ella recomienda hace más de un año. El idol demuestra que tenía razón."),
  4: ("셋째, 큰 계정은 조회수 말고 배수를 보세요. 그래도 '팔로워 질문으로 시작하기'는 계정 크기랑 상관없이 써먹을 수 있어요.",
      "Tres: en cuentas grandes, mira el multiplicador, no las vistas. Pero empezar con una pregunta de tus seguidores sirve para cualquier cuenta.")}),
"021": ([0,1,3,4,6,7], {
  4: ("셋째, 팔로워 10만이 안 되는 계정 105개 중에 16개가 100만 뷰를 넘겼어요. 계정이 작아서 안 된다는 건 틀렸어요.",
      "Tres: de 105 cuentas con menos de 100 mil seguidores, 16 pasaron el millón de vistas. 'Mi cuenta es muy pequeña' no se sostiene."),
  1: ("첫째, 첫 자막이 '한국 여자들의 완벽한 피부 비법'이에요. 3초 만에 결과부터 보여주고요.",
      "Uno: el primer texto es 'el truco de las coreanas para una piel perfecta'. Y a los 3 segundos, el resultado.")}),
"022": ([0,1,2,3,4,5], {
  3: ("셋째, 제가 모은 남미 영상에서 15초 이하 영상이 조회수 중간값 36만으로, 더 긴 영상보다 높았어요.",
      "Tres: en los videos de LATAM que reuní, los de 15 segundos o menos tuvieron una mediana de 360 mil vistas, más que los largos.")}),
"023": ([0,1,2,3,5,6], {
  2: ("둘째, 014편은 크림 하나였고, 이 영상은 2초마다 신기한 제품이 바뀌어요. 그게 15배 차이를 만들었어요.",
      "Dos: el 014 era una sola crema; aquí cambia a otro producto raro cada 2 segundos. Eso hizo la diferencia de 15 veces."),
  3: ("셋째, 자막에 제품 이름이 없어요. 그래서 댓글로 물어보고, 그게 2,600개가 넘었어요.",
      "Tres: el texto no tiene nombres de productos. Por eso preguntan en comentarios: más de 2.600.")}),
"024": ([0,1,3,4,5,6], {
  3: ("둘째, 끝에 '다음 영상에서 네 루틴 짜줄게, 신청해'라고 써요. 댓글 1,600개가 다 다음 영상 주제예요.",
      "Dos: al final escribe 'en el próximo video armo tu rutina, pídela'. Sus 1.600 comentarios son temas para el próximo video."),
  4: ("셋째, 한 번 터진 포맷을 버리지 않았어요. 013편이 75배, 이 영상이 58배예요.",
      "Tres: no abandonó el formato que le funcionó. El 013, 75 veces; este, 58.")}),
"025": ([0,1,2,4,5,6], {
  2: ("둘째, 4초 만에 깨끗해진 '내 손님 피부'를 보여줘요. 판매자 말보다 손님 결과가 훨씬 믿겨요.",
      "Dos: a los 4 segundos muestra la piel limpia 'de mi clienta'. El resultado de una clienta se cree más que la vendedora."),
  4: ("셋째, 다만 남의 얼굴이면 꼭 동의를 받으세요. 효과를 부풀리면 신고 대상이에요.",
      "Tres: pero si es la cara de otra persona, pide permiso. Si exageras el efecto, te pueden reportar.")}),
"026": ([0,1,3,4,5,6], {
  3: ("둘째, 그런데 570만 명이 봤는데 공유는 299번이에요. 남미 K뷰티 영상 중간값의 5분의 1도 안 돼요.",
      "Dos: pero lo vieron 5,7 millones y solo se compartió 299 veces. Ni la quinta parte de la mediana en K-beauty de LATAM."),
  4: ("셋째, 많이 봤는데 아무도 안 퍼뜨렸다면 광고비로 밀어준 영상일 가능성이 커요. 조회수만 보고 따라 하면 안 돼요.",
      "Tres: si muchos lo vieron y nadie lo compartió, lo más probable es que sea pauta pagada. No lo copies solo por las vistas.")}),
}
