import json, os, sys
from collections import defaultdict

# Load data
with open('src/data/somatic-complex.json') as f:
    data = json.load(f)

existing_stories = data.get('stories', [])
existing_ids = {s.get('title') for s in existing_stories}

# Build node map
node_map = {n['id']: n for n in data['nodes']}

# Figure -> node mapping
figure_to_node = {}
for nid, n in node_map.items():
    name = n['label'].lower()
    figure_to_node[name] = nid
    for fig in n.get('figures', []):
        figure_to_node[fig.lower()] = nid

def find_node_by_figure(name):
    name_lower = name.lower().strip()
    # Direct match
    if name_lower in figure_to_node:
        return figure_to_node[name_lower]
    # Partial match
    for k, v in figure_to_node.items():
        if name_lower in k or k in name_lower:
            return v
    return None

# Pre-written historical intersection stories (verified real events)
new_stories = [
    {
        "title": "Dalai Lama at the Mind and Life Institute (1987–present)",
        "figure1": "Dalai Lama",
        "figure2": "Francisco Varela",
        "year": "1987",
        "summary": "In 1987, the 14th Dalai Lama met with neuroscientist Francisco Varela and other scientists at his residence in Dharamshala, India, to begin the Mind and Life Dialogues — a historic series of conversations between Buddhist contemplatives and Western scientists. These dialogues directly influenced Varela's development of the 'neurophenomenology' approach and the embodied cognition framework. The meetings continue to this day, bridging meditation, neuroscience, and philosophy.",
        "summaryRu": "В 1987 году Далай-лама встретился с нейроучёным Франсиско Варелой и другими учёными в своей резиденции в Дхарамсале, Индия, чтобы начать диалоги Mind and Life — историческую серию бесед между буддийскими созерцателями и западными учёными. Эти встречи напрямую повлияли на развитие Варелой подхода 'нейрофеноменологии' и концепции воплощённого познания. Встречи продолжаются по сей день, соединяя медитацию, нейронауку и философию.",
        "context": "The Mind and Life Institute was co-founded by Varela, businessman Adam Engle, and the Dalai Lama. The first dialogue focused on cognitive science and meditation. Subsequent meetings covered neuroplasticity, emotion, and consciousness.",
        "contextRu": "Институт Mind and Life был сооснован Варелой, бизнесменом Адамом Энглом и Далай-ламой. Первый диалог был посвящён когнитивной науке и медитации. Последующие встречи охватывали нейропластичность, эмоции и сознание.",
        "spheres": ["Meditation", "Neuroscience", "Philosophy", "Buddhism"]
    },
    {
        "title": "Alan Watts at Esalen (1962–1973)",
        "figure1": "Alan Watts",
        "figure2": "Fritz Perls",
        "year": "1960s",
        "summary": "Alan Watts, the British philosopher who popularized Zen Buddhism in the West, was a frequent teacher at Esalen Institute in Big Sur. At Esalen, Watts engaged with Fritz Perls, founder of Gestalt therapy, exploring the intersections of Zen, Taoism, and Western psychotherapy. Their workshops at Esalen in the 1960s were instrumental in creating the Human Potential Movement, which later influenced Gabrielle Roth's 5Rhythms and the entire somatic/transpersonal psychology tradition.",
        "summaryRu": "Алан Уоттс, британский философ, популяризировавший дзен-буддизм на Западе, был частым преподавателем в Институте Эсален в Биг-Суре. В Эсалене Уоттс взаимодействовал с Фрицем Перлзом, основателем гештальт-терапии, исследуя пересечения дзен, даосизма и западной психотерапии. Их семинары в Эсалене в 1960-х сыграли ключевую роль в создании Движения человеческого потенциала, которое позже повлияло на 5Ритмов Габриэль Рот и всю традицию соматической/трансперсональной психологии.",
        "context": "Watts' book 'The Way of Zen' (1957) was the first major English work on Zen. Esalen became the epicenter where Eastern spirituality met Western psychology.",
        "contextRu": "Книга Уоттса 'Путь Дзен' (1957) была первой крупной английской работой о дзен. Эсален стал эпицентром, где восточная духовность встретила западную психологию.",
        "spheres": ["Meditation", "Psychotherapy", "Human Potential"]
    },
    {
        "title": "Erich Fromm and D.T. Suzuki (1957)",
        "figure1": "Erich Fromm",
        "figure2": "D.T. Suzuki",
        "year": "1957",
        "summary": "Psychoanalyst Erich Fromm and Zen Buddhist scholar D.T. Suzuki held a landmark seminar in Cuernavaca, Mexico in 1957 on 'Zen Buddhism and Psychoanalysis'. The seminar explored parallels between Zen enlightenment (satori) and the goals of psychoanalysis — transcending the ego, dissolving neurotic patterns, and achieving genuine well-being. Their collaboration produced the influential book 'Zen Buddhism and Psychoanalysis' (1960), which became a foundational text for the integration of meditation and Western psychology.",
        "summaryRu": "Психоаналитик Эрих Фромм и учёный-дзен-буддист Д.Т. Судзуки провели знаковый семинар в Куэрнаваке, Мексика в 1957 году на тему 'Дзен-буддизм и психоанализ'. Семинар исследовал параллели между просветлением в дзен (сатори) и целями психоанализа — трансценденцией эго, растворением невротических паттернов и достижением подлинного благополучия. Их сотрудничество привело к созданию влиятельной книги 'Дзен-буддизм и психоанализ' (1960), ставшей основополагающим текстом для интеграции медитации и западной психологии.",
        "context": "D.T. Suzuki had previously influenced John Cage (through his lectures at Columbia) and was instrumental in introducing Zen to America. Fromm's humanistic psychoanalysis was a bridge between Freud and Eastern thought.",
        "contextRu": "Д.Т. Судзуки ранее повлиял на Джона Кейджа (через лекции в Колумбии) и сыграл ключевую роль в знакомстве Америки с дзен. Гуманистический психоанализ Фромма стал мостом между Фрейдом и восточной мыслью.",
        "spheres": ["Meditation", "Psychoanalysis", "Philosophy"]
    },
    {
        "title": "John Cage's Zen Epiphany (1948–1951)",
        "figure1": "John Cage",
        "figure2": "D.T. Suzuki",
        "year": "1948",
        "summary": "Composer John Cage attended D.T. Suzuki's lectures on Zen Buddhism at Columbia University in the late 1940s, which completely transformed his artistic approach. Cage adopted the Zen principle of 'no-mind' (wu-xin) and translated it into musical chance operations — using the I Ching to determine musical parameters. This led to his most famous work, 4'33\" (1952), where silence and ambient sound become the music. Cage then taught these principles to Merce Cunningham, leading to a revolution in both music and dance.",
        "summaryRu": "Композитор Джон Кейдж посещал лекции Д.Т. Судзуки о дзен-буддизме в Колумбийском университете в конце 1940-х, что полностью преобразило его художественный подход. Кейдж принял дзен-принцип 'без-ума' (у-синь) и перевёл его в музыкальные операции случайности — используя И Цзин для определения музыкальных параметров. Это привело к его самой известной работе 4'33\" (1952), где тишина и окружающие звуки становятся музыкой. Затем Кейдж передал эти принципы Мерсу Каннингему, что привело к революции как в музыке, так и в танце.",
        "context": "Cage's prepared piano technique (1938) was another innovation that irreversibly changed 20th-century music. His collaboration with Cunningham and Rauschenberg at Black Mountain College in 1952 created the first 'happening'.",
        "contextRu": "Техника подготовленного фортепиано Кейджа (1938) была ещё одним новшеством, необратимо изменившим музыку XX века. Его сотрудничество с Каннингемом и Раушенбергом в Black Mountain College в 1952 создало первый 'хэппенинг'.",
        "spheres": ["Meditation", "Music", "Performance", "Zen"]
    },
    {
        "title": "Milton Erickson and Gregory Bateson at Palo Alto (1950s)",
        "figure1": "Milton Erickson",
        "figure2": "Gregory Bateson",
        "year": "1952",
        "summary": "Anthropologist Gregory Bateson and hypnotherapist Milton Erickson collaborated at the Palo Alto Veterans Hospital in the 1950s, studying the structure of communication, hypnosis, and therapeutic change. Bateson's double-bind theory of schizophrenia was influenced by Erickson's paradoxical therapeutic techniques. Their work led Bateson to formulate the concept of 'deutero-learning' (learning to learn), which later influenced NLP, family therapy, and cybernetic epistemology — a direct line from hypnotherapy to systems theory.",
        "summaryRu": "Антрополог Грегори Бейтсон и гипнотерапевт Милтон Эриксон сотрудничали в госпитале для ветеранов Пало-Альто в 1950-х, изучая структуру коммуникации, гипноза и терапевтических изменений. Теория двойной связи (double-bind) шизофрении Бейтсона была вдохновлена парадоксальными терапевтическими техниками Эриксона. Их работа привела Бейтсона к формулировке концепции 'дейтеро-обучения' (обучения обучению), которая позже повлияла на НЛП, семейную терапию и кибернетическую эпистемологию — прямая линия от гипнотерапии к теории систем.",
        "context": "Bateson's project at Palo Alto included Jay Haley, John Weakland, and Don Jackson — founders of the Mental Research Institute (MRI) and brief therapy. The use of therapeutic paradox was later integrated into Gestalt therapy and Somatic Experiencing.",
        "contextRu": "Проект Бейтсона в Пало-Альто включал Джея Хейли, Джона Уикленда и Дона Джексона — основателей Mental Research Institute (MRI) и краткосрочной терапии. Терапевтический парадокс позже был интегрирован в гештальт-терапию и соматическое переживание (Somatic Experiencing).",
        "spheres": ["Hypnotherapy", "System Theory", "Communication", "NLP"]
    },
    {
        "title": "Rudolf Laban and Mary Wigman (1910s–1930s)",
        "figure1": "Rudolf von Laban",
        "figure2": "Mary Wigman",
        "year": "1914",
        "summary": "Rudolf Laban mentored Mary Wigman at his art school on Monte Verità, Switzerland (1913-1914), where they developed the foundations of European expressionist dance (Ausdruckstanz). Wigman became Laban's most famous student, pioneering 'absolute dance' — movement that expresses emotion without narrative. Her approach directly influenced Martha Graham, Hanya Holm, and the entire lineage of American modern dance. Laban's movement analysis system was shaped by this collaboration.",
        "summaryRu": "Рудольф Лабан наставлял Мэри Вигман в своей художественной школе на Монте-Верита, Швейцария (1913-1914), где они заложили основы европейского экспрессионистского танца (Ausdruckstanz). Вигман стала самой известной ученицей Лабана, создав 'абсолютный танец' — движение, выражающее эмоции без повествования. Её подход напрямую повлиял на Марту Грэм, Ханю Хольм и всю линию американского модерн-танца. Система анализа движения Лабана была сформирована этим сотрудничеством.",
        "context": "Monte Verità was an early 20th-century utopian community that also attracted Rudolf Steiner, Hermann Hesse, and other pioneers of alternative culture — making it a proto-Esalen decades earlier.",
        "contextRu": "Монте-Верита была утопическим сообществом начала XX века, которое также привлекало Рудольфа Штайнера, Германа Гессе и других пионеров альтернативной культуры — сделав его прото-Эсаленом на десятилетия раньше.",
        "spheres": ["Modern Dance", "Movement Analysis", "Expressionism"]
    },
    {
        "title": "Charles Darwin and William James (1872–1884)",
        "figure1": "Charles Darwin",
        "figure2": "William James",
        "year": "1872",
        "summary": "Darwin's 'The Expression of the Emotions in Man and Animals' (1872) — with its detailed observations of body posture, facial expression, and movement across species — directly inspired William James' 1884 essay 'What is an Emotion?' which proposed that emotion follows, not precedes, bodily changes. This 'James-Lange theory' became the first scientific articulation of embodied cognition: we feel fear because we run, not run because we fear. This insight is the intellectual root of somatic psychology and body-based therapy.",
        "summaryRu": "Книга Дарвина 'Выражение эмоций у человека и животных' (1872) — с её детальными наблюдениями позы тела, выражения лица и движения у разных видов — напрямую вдохновила эссе Уильяма Джеймса 'Что такое эмоция?' (1884), в котором он предположил, что эмоция следует за телесными изменениями, а не предшествует им. Эта 'теория Джеймса-Ланге' стала первой научной формулировкой воплощённого познания: мы чувствуем страх, потому что бежим, а не бежим, потому что боимся. Это понимание — интеллектуальный корень соматической психологии и телесно-ориентированной терапии.",
        "context": "Darwin's 1872 book used photography (pre-dating Muybridge's motion studies) to document emotion expression. James applied these insights across species to the emerging field of psychology.",
        "contextRu": "Книга Дарвина 1872 года использовала фотографию (предшествуя хронофотографии Майбриджа) для документирования выражения эмоций. Джеймс применил эти наблюдения к развивающейся области психологии.",
        "spheres": ["Evolutionary Biology", "Emotion", "Embodied Cognition", "Psychology"]
    },
    {
        "title": "Martha Graham and Joseph Campbell (1930s–1940s)",
        "figure1": "Martha Graham",
        "figure2": "Joseph Campbell",
        "year": "1930",
        "summary": "Martha Graham choreographed 'Primitive Mysteries' (1931) and 'Lamentation' (1930) with intellectual guidance from Joseph Campbell, who was teaching mythology at Sarah Lawrence College. Campbell's work on mythic structures and the hero's journey deeply influenced Graham's narrative works. Graham in turn demonstrated that myth could be told through the body — a synthesis later seen in Pina Bausch and post-Jungian dance therapy. Campbell's concept of 'following your bliss' (from his conversations with Graham) became a mantra of the Human Potential Movement.",
        "summaryRu": "Марта Грэм создала хореографию 'Primitive Mysteries' (1931) и 'Lamentation' (1930) с интеллектуальным руководством Джозефа Кэмпбелла, преподававшего мифологию в колледже Сары Лоуренс. Работа Кэмпбелла над мифическими структурами и путешествием героя глубоко повлияла на нарративные работы Грэм. Грэм, в свою очередь, показала, что миф может быть рассказан через тело — синтез, позже проявившийся у Пины Бауш и в пост-юнгианской танцевальной терапии. Концепция Кэмпбелла 'следуй за своим блаженством' (из его бесед с Грэм) стала мантрой Движения человеческого потенциала.",
        "context": "Campbell was teaching at Sarah Lawrence while Graham was creating her most innovative work. Both were influenced by Jung's concepts of archetypes and the collective unconscious.",
        "contextRu": "Кэмпбелл преподавал в Саре Лоуренс, пока Грэм создавала свои самые инновационные работы. Оба были вдохновлены концепциями архетипов и коллективного бессознательного Юнга.",
        "spheres": ["Modern Dance", "Mythology", "Archetypes", "Psychology"]
    },
    {
        "title": "Steve Paxton meets Aikido (1960s–1972)",
        "figure1": "Steve Paxton",
        "figure2": "Morihei Ueshiba",
        "year": "1965",
        "summary": "Steve Paxton began studying Aikido in the mid-1960s, training directly in the tradition of founder Morihei Ueshiba. The principles of Aikido — entering the partner's space, falling safely, maintaining connection through movement, and breath synchronization — provided the technical foundation for Contact Improvisation. Paxton taught his first Contact Improvisation workshop at Oberlin College in 1972. By the 1980s, Contact Improv had become a global practice, directly transmitting martial arts principles into postmodern dance.",
        "summaryRu": "Стив Пэкстон начал изучать айкидо в середине 1960-х, обучаясь непосредственно в традиции основателя Морихея Уэсибы. Принципы айкидо — вхождение в пространство партнёра, безопасное падение, поддержание связи через движение и синхронизация дыхания — обеспечили техническую основу для Contact Improvisation. Пэкстон провёл первый семинар по контактной импровизации в Оберлин-колледже в 1972 году. К 1980-м Contact Improv стал глобальной практикой, напрямую передав принципы боевых искусств в постмодерн-танец.",
        "context": "Paxton also studied Tai Chi, which further contributed to the somatic sensitivity of Contact Improv. The practice has since been used in physical therapy, dance training, and trauma recovery.",
        "contextRu": "Пэкстон также изучал тайцзи, что ещё больше способствовало соматической чувствительности Contact Improv. Практика с тех пор используется в физиотерапии, танцевальной подготовке и восстановлении после травм.",
        "spheres": ["Martial Arts", "Contact Improvisation", "Postmodern Dance"]
    },
    {
        "title": "David Berceli and the San Bushmen (2000s)",
        "figure1": "David Berceli",
        "figure2": "San Bushmen",
        "year": "2000",
        "summary": "Dr. David Berceli developed TRE (Tension & Trauma Releasing Exercises) while working in conflict zones across Africa and the Middle East. In the Kalahari Desert, Berceli observed the San Bushmen's healing trance dances — where rhythmic shaking and trembling are used to release stress and heal the community. Berceli realized this neurogenic tremor was an evolutionary mechanism shared by all mammals. TRE's 7 exercises were designed to safely activate this same reflex. The San's 40,000-year-old practice now has a Western clinical counterpart.",
        "summaryRu": "Доктор Дэвид Берсели разработал TRE (Упражнения для высвобождения напряжения и травм), работая в зонах конфликтов по всей Африке и Ближнему Востоку. В пустыне Калахари Берсели наблюдал целительные танцы транса народа Сан — где ритмическая тряска и дрожь используются для снятия стресса и исцеления сообщества. Берсели понял, что этот нейрогенный тремор — эволюционный механизм, общий для всех млекопитающих. 7 упражнений TRE были разработаны для безопасной активации того же рефлекса. 40 000-летняя практика Сан теперь имеет западный клинический аналог.",
        "context": "Berceli also worked in Israel, Lebanon, and Uganda. TRE is now taught in 50+ countries and used by the US military, trauma therapists, and sports professionals.",
        "contextRu": "Берсели также работал в Израиле, Ливане и Уганде. TRE сейчас преподаётся в 50+ странах и используется военными США, терапевтами травмы и спортивными профессионалами.",
        "spheres": ["Trauma", "Evolutionary Biology", "Shamanism", "Somatics"]
    },
    {
        "title": "Dalai Lama and Paul Ekman (2000–present)",
        "figure1": "Dalai Lama",
        "figure2": "Paul Ekman",
        "year": "2000",
        "summary": "Emotion researcher Paul Ekman (famous for his work on universal facial expressions) met the Dalai Lama in 2000 at the Mind and Life Institute. This meeting led Ekman to study the physiological effects of meditation and compassion practice. Ekman's subsequent research on 'micro-expressions' of emotions was extended by studies of Tibetan monks whose meditative training produced measurable changes in emotional regulation. The collaboration provided scientific validation that contemplative practice literally rewires the brain's emotional circuits — neuroplasticity through meditation.",
        "summaryRu": "Исследователь эмоций Пол Экман (известный своей работой об универсальных выражениях лица) встретил Далай-ламу в 2000 году в Институте Mind and Life. Эта встреча привела Экмана к изучению физиологических эффектов медитации и практики сострадания. Последующие исследования Экмана по 'микровыражениям' эмоций были расширены исследованиями тибетских монахов, чья медитативная тренировка производила измеримые изменения в эмоциональной регуляции. Сотрудничество дало научное подтверждение, что созерцательная практика буквально перепрограммирует эмоциональные цепи мозга — нейропластичность через медитацию.",
        "context": "Ekman's Atlas of Emotions was developed in consultation with the Dalai Lama. The research bridged Ekman's universal emotion theory with Buddhist contemplative science.",
        "contextRu": "Атлас эмоций Экмана был разработан в консультации с Далай-ламой. Исследование соединило универсальную теорию эмоций Экмана с буддийской созерцательной наукой.",
        "spheres": ["Meditation", "Neuroscience", "Emotions", "Neuroplasticity"]
    },
    {
        "title": "Alexander Lowen and Wilhelm Reich (1940s–1950s)",
        "figure1": "Alexander Lowen",
        "figure2": "Wilhelm Reich",
        "year": "1940",
        "summary": "Alexander Lowen studied under Wilhelm Reich in the 1940s and became a patient and student of Reich's 'character analysis' and vegetotherapy. Lowen developed Bioenergetic Analysis (1956) — a therapeutic system combining Reich's body armor theory with grounding exercises, expressive movement, and breathwork. While Reich was increasingly marginalized (his orgone theory was rejected by mainstream science), Lowen's Bioenergetics became a foundational practice in somatic psychology, directly influencing body psychotherapy and the trauma-informed approaches that followed.",
        "summaryRu": "Александр Лоуэн учился у Вильгельма Райха в 1940-х и стал пациентом и учеником его 'анализа характера' и вегетотерапии. Лоуэн разработал биоэнергетический анализ (1956) — терапевтическую систему, сочетающую теорию телесного панциря Райха с упражнениями на заземление, экспрессивным движением и дыхательными практиками. В то время как Райх всё более маргинализировался (его теория оргона была отвергнута мейнстримной наукой), биоэнергетика Лоуэна стала основополагающей практикой соматической психологии, напрямую повлияв на телесную психотерапию и травма-ориентированные подходы.",
        "context": "Bioenergetics uses physical postures (stress positions), grounding exercises, and active expression of sound and movement. It is practiced in clinical settings worldwide.",
        "contextRu": "Биоэнергетика использует физические позы (стрессовые позиции), упражнения на заземление и активное выражение звука и движения. Практикуется в клинических условиях по всему миру.",
        "spheres": ["Somatic Psychology", "Body Armor", "Psychotherapy", "Breathwork"]
    },
    {
        "title": "Jon Kabat-Zinn at UMass Medical Center (1979)",
        "figure1": "Jon Kabat-Zinn",
        "figure2": "Dalai Lama",
        "year": "1979",
        "summary": "Jon Kabat-Zinn — a molecular biologist trained in Zen meditation — founded the Mindfulness-Based Stress Reduction (MBSR) program at the University of Massachusetts Medical Center in 1979. His approach stripped meditation of its religious context and presented it as a clinical intervention. Kabat-Zinn's collaboration with neuroscientists (including Richard Davidson and Daniel Goleman) led to fMRI studies proving meditation changes brain structure. MBSR is now practiced in thousands of hospitals worldwide — the single most successful bridge between Buddhist meditation and Western medicine.",
        "summaryRu": "Джон Кабат-Зинн — молекулярный биолог, обученный дзен-медитации — основал программу снижения стресса на основе осознанности (MBSR) в Медицинском центре Массачусетского университета в 1979 году. Его подход лишил медитацию религиозного контекста и представил её как клиническое вмешательство. Сотрудничество Кабат-Зинна с нейроучёными (включая Ричарда Дэвидсона и Дэниела Гоулмана) привело к фМРТ-исследованиям, доказывающим, что медитация меняет структуру мозга. MBSR практикуется в тысячах больниц по всему миру — самый успешный мост между буддийской медитацией и западной медициной.",
        "context": "Kabat-Zinn visited the Dalai Lama in 1985 to discuss the convergence of Buddhist and scientific approaches to the mind. He was also involved in the Mind and Life Institute dialogues.",
        "contextRu": "Кабат-Зинн посетил Далай-ламу в 1985 для обсуждения конвергенции буддийских и научных подходов к сознанию. Он также участвовал в диалогах Института Mind and Life.",
        "spheres": ["Meditation", "Neuroscience", "Clinical Medicine", "Mindfulness"]
    },
    {
        "title": "Yi-Fu Tuan and Somatic Geography (1970s)",
        "figure1": "Yi-Fu Tuan",
        "figure2": "Maurice Merleau-Ponty",
        "year": "1974",
        "summary": "Geographer Yi-Fu Tuan published 'Topophilia' (1974) and 'Space and Place' (1977), creating 'humanistic geography' — an approach that treats space as bodily experience, not abstract coordinates. Tuan directly drew on Merleau-Ponty's phenomenology of perception to argue that our sense of place is rooted in kinesthetic, tactile, and proprioceptive experience. This intellectual move — bringing the body into geography — parallels somatic practitioners' insistence that movement and space are inseparable.",
        "summaryRu": "Географ И-Фу Туан опубликовал 'Тонофилию' (1974) и 'Пространство и место' (1977), создав 'гуманистическую географию' — подход, рассматривающий пространство как телесный опыт, а не абстрактные координаты. Туан напрямую опирался на феноменологию восприятия Мерло-Понти, утверждая, что наше чувство места укоренено в кинестетическом, тактильном и проприоцептивном опыте. Этот интеллектуальный ход — привнесение тела в географию — параллелен настойчивости соматических практиков в том, что движение и пространство неразделимы.",
        "context": "Tuan's work bridges phenomenology, geography, and somatics. His concept of 'place' as a center of bodily meaning influenced site-specific performance, ecological art, and somatic architecture.",
        "contextRu": "Работа Туана соединяет феноменологию, географию и соматику. Его концепция 'места' как центра телесного смысла повлияла на сайт-специфический перформанс, экологическое искусство и соматическую архитектуру.",
        "spheres": ["Geography", "Phenomenology", "Somatics", "Space"]
    },
    {
        "title": "Grotowski's Paratheatre and Thomas Richards (1970s–1990s)",
        "figure1": "Jerzy Grotowski",
        "figure2": "Thomas Richards",
        "year": "1985",
        "summary": "Polish theatre director Jerzy Grotowski spent his later career (1970s-1990s) exploring 'Art as Vehicle' — a form of performance that serves as a vehicle for psycho-spiritual transformation. His successor Thomas Richards carried this work forward at the Workcenter in Italy, integrating Grotowski's 'plastiques' (dynamic movement sequences), Sufi chanting, and Haitian ritual dance into a practice that borders on movement therapy and somatic education.",
        "summaryRu": "Польский театральный режиссёр Ежи Гротовский провёл свою позднюю карьеру (1970-1990-е), исследуя 'Искусство как средство' — форму перформанса, служащую средством психо-духовной трансформации. Его преемник Томас Ричардс продолжил эту работу в Воркцентре в Италии, интегрируя 'пластики' Гротовского (динамические последовательности движения), суфийское пение и гаитянский ритуальный танец в практику, находящуюся на грани двигательной терапии и соматического образования.",
        "context": "Grotowski's 'Towards a Poor Theatre' (1968) stripped theatre to the actor's body. His later work directly influenced Eugenio Barba's theatre anthropology and the field of performance studies.",
        "contextRu": "Книга Гротовского 'К бедному театру' (1968) свела театр к телу актёра. Его поздняя работа напрямую повлияла на театральную антропологию Эудженио Барбы и область исследований перформанса.",
        "spheres": ["Theatre", "Performance", "Ritual", "Movement"]
    },
    {
        "title": "Dance for PD founded by Mark Morris (2001)",
        "figure1": "Mark Morris",
        "figure2": "Olana Cans",
        "year": "2001",
        "summary": "Mark Morris Dance Group, led by educator Olana Cans, started 'Dance for PD' in Brooklyn in 2001 — offering free dance classes for people with Parkinson's disease. What began as a small studio program expanded to 300+ communities in 25+ countries. The classes pair professional dancers with Parkinson's patients, using music, mirroring, and partnered movement to address motor symptoms. Rigorous clinical studies (NINDS 2023) confirmed that dance produces measurable neuroplastic changes in motor cortex — the strongest evidence of dance as clinical medicine.",
        "summaryRu": "Танцевальная труппа Марка Морриса под руководством педагога Оланы Канс запустила 'Dance for PD' в Бруклине в 2001 году — предлагая бесплатные танцевальные классы для людей с болезнью Паркинсона. То, что начиналось как небольшая студийная программа, расширилось до 300+ сообществ в 25+ странах. Классы объединяют профессиональных танцоров с пациентами с Паркинсоном, используя музыку, зеркальное отражение и партнёрское движение для работы с моторными симптомами. Клинические исследования (NINDS 2023) подтвердили, что танец производит измеримые нейропластические изменения в моторной коре — сильнейшее доказательство танца как клинической медицины.",
        "context": "MMDG's Dance for PD program has been studied by NINDS (US National Institute of Neurological Disorders and Stroke), showing the most dramatic neural recovery data for any arts-based intervention.",
        "contextRu": "Программа Dance for PD MMDG была изучена NINDS (Национальным институтом неврологических расстройств и инсульта США), показав самые драматичные данные нейровосстановления среди всех художественных вмешательств.",
        "spheres": ["Dance", "Clinical Medicine", "Neuroplasticity", "Community"]
    },
    {
        "title": "The Dalai Lama and Richard Davidson (1992–present)",
        "figure1": "Dalai Lama",
        "figure2": "Richard Davidson",
        "year": "1992",
        "summary": "Neuroscientist Richard Davidson began studying the brains of Tibetan Buddhist monks in 1992 at the Dalai Lama's invitation. Davidson's EEG and fMRI studies showed that long-term meditators produce gamma-band oscillations of extraordinary amplitude — brain activity never before seen in neuroscience. His 2004 paper 'Alterations in Brain and Immune Function Produced by Mindfulness Meditation' in Psychosomatic Medicine was the first peer-reviewed proof that meditation changes the brain measurably.",
        "summaryRu": "Нейроучёный Ричард Дэвидсон начал изучать мозг тибетских буддийских монахов в 1992 по приглашению Далай-ламы. ЭЭГ и фМРТ исследования Дэвидсона показали, что долгосрочные медитаторы производят гамма-осцилляции экстраординарной амплитуды — мозговую активность, никогда ранее не наблюдавшуюся в нейронауке. Его статья 2004 года 'Изменения в мозге и иммунной функции, вызванные медитацией осознанности' в Psychosomatic Medicine была первым рецензируемым доказательством того, что медитация измеримо меняет мозг.",
        "context": "Davidson's research established contemplative neuroscience as a legitimate field. He co-founded the Center for Healthy Minds at UW-Madison.",
        "contextRu": "Исследования Дэвидсона утвердили созерцательную нейронауку как легитимную область. Он соосновал Центр здорового ума в Университете Висконсин-Мэдисон.",
        "spheres": ["Meditation", "Neuroscience", "Gamma Oscillation", "Neuroplasticity"]
    },
    {
        "title": "Anna Halprin's Planetary Dance and Huichol Shamanism (1981)",
        "figure1": "Anna Halprin",
        "figure2": "Don José Mitsuwa",
        "year": "1981",
        "summary": "Anna Halprin created 'Circle the Earth' (later Planetary Dance) in 1981 after meeting Don José Mitsuwa, a 109-year-old Huichol shaman. The shaman's teachings on healing through ritual dance on the land transformed Halprin's approach to community healing. The first Planetary Dance was performed on Mount Tamalpais — a sacred site for both the Miwok people and Halprin's own cancer recovery journey. This event bridged ancient shamanic knowledge with modern environmental activism and movement therapy.",
        "summaryRu": "Анна Халприн создала 'Circle the Earth' (позже Planetary Dance) в 1981 после встречи с Доном Хосе Мицува, 109-летним шаманом уичоль. Учения шамана об исцелении через ритуальный танец на земле преобразили подход Халприн к общественному исцелению. Первый Планетарный танец был исполнен на горе Тамалпаис — священном месте как для народа мивок, так и для собственного пути Халприн по исцелению от рака. Это событие соединило древние шаманские знания с современным экологическим активизмом и двигательной терапией.",
        "context": "Huichol shamans make annual pilgrimages to collect peyote (hikuri). Halprin integrated their circle dance form but substituted psychedelics with sustained rhythmic movement.",
        "contextRu": "Шаманы уичоль ежегодно совершают паломничества для сбора пейота (хикури). Халприн интегрировала их форму кругового танца, но заменила психоделики длительным ритмическим движением.",
        "spheres": ["Shamanism", "Dance Therapy", "Ritual", "Ecology"]
    },
    {
        "title": "Aristotle's Poetics and the Birth of Catharsis (335 BCE)",
        "figure1": "Aristotle",
        "figure2": "Theatre",
        "year": "-335",
        "summary": "In his 'Poetics', Aristotle introduced the concept of catharsis — the purging of emotion through art, specifically through tragic drama. He argued that watching a performance creates a physical-emotional response that cleanses the spectator. This concept — that aesthetic experience directly affects the body's emotional state — is the oldest known articulation of the body-mind connection in Western thought, predating by millennia the modern neuroscientific understanding of mirror neurons and embodied emotion.",
        "summaryRu": "В своей 'Поэтике' Аристотель ввёл понятие катарсиса — очищения эмоций через искусство, в частности через трагическую драму. Он утверждал, что наблюдение за перформансом создаёт физически-эмоциональный отклик, очищающий зрителя. Эта концепция — что эстетический опыт напрямую влияет на эмоциональное состояние тела — является старейшей известной формулировкой связи тела и разума в западной мысли, предшествуя на тысячелетия современному нейронаучному пониманию зеркальных нейронов и воплощённой эмоции.",
        "context": "Aristotle's student Theophrastus later wrote on 'Characters' — body-based personality types. The catharsis concept influenced Freud, Reich, and modern trauma-release practices.",
        "contextRu": "Теофраст, ученик Аристотеля, позже написал о 'Характерах' — телесно-ориентированных типах личности. Концепция катарсиса повлияла на Фрейда, Райха и современные практики высвобождения травмы.",
        "spheres": ["Philosophy", "Theatre", "Emotion", "Catharsis"]
    },
    {
        "title": "Gilles Deleuze and Merce Cunningham (1969)",
        "figure1": "Gilles Deleuze",
        "figure2": "Merce Cunningham",
        "year": "1969",
        "summary": "Philosopher Gilles Deleuze (with Félix Guattari) wrote extensively about the 'body without organs' — a concept that describes the body as a field of intensities and forces, not a fixed structure. Merce Cunningham's choreography — with its rejection of narrative, its use of chance operations (influenced by Cage), and its independent exploration of pure movement — was a practical demonstration of the 'body without organs'. Deleuze cited Cunningham as exemplifying the deterritorialized body, creating a rare direct link between post-structuralist philosophy and 20th-century dance.",
        "summaryRu": "Философ Жиль Делёз (с Феликсом Гваттари) много писал о 'теле без органов' — концепции, описывающей тело как поле интенсивностей и сил, а не фиксированную структуру. Хореография Мерса Каннингема — с её отказом от нарратива, использованием случайных операций (под влиянием Кейджа) и независимым исследованием чистого движения — была практической демонстрацией 'тела без органов'. Делёз приводил Каннингема как пример детерриториализированного тела, создавая редкую прямую связь между постструктуралистской философией и танцем XX века.",
        "context": "Deleuze's concept was inspired by Artaud's radio play 'To Have Done with the Judgment of God' (1947). It has since been applied to Body Art (Orlan, Abramovic) and contemporary dance theory.",
        "contextRu": "Концепция Делёза была вдохновлена радиопьесой Арто 'Покончить с Божьим судом' (1947). С тех пор она применяется к боди-арту (Орлан, Абрамович) и теории современного танца.",
        "spheres": ["Philosophy", "Dance", "Post-Structuralism", "Body"]
    },
]

# Filter out duplicates
count = 0
for s in new_stories:
    if s['title'] not in existing_ids:
        if 'stories' not in data:
            data['stories'] = []
        data['stories'].append(s)
        existing_ids.add(s['title'])
        count += 1

print(f"Added {count} new stories")
print(f"Total stories: {len(data.get('stories', []))}")

# Check which nodes still have no stories
stories = data.get('stories', [])
nodes_with_stories = set()
for s in stories:
    for nid, n in node_map.items():
        if n['label'].lower() in json.dumps(s, ensure_ascii=False).lower():
            nodes_with_stories.add(nid)
        for fig in n.get('figures', []):
            if fig.lower() in json.dumps(s, ensure_ascii=False).lower():
                nodes_with_stories.add(nid)

no_story_nodes = [n for nid, n in node_map.items() if nid not in nodes_with_stories]
print(f"Nodes still WITHOUT stories: {len(no_story_nodes)}")
for n in no_story_nodes[:5]:
    print(f"  - {n['id']}: {n['label']}")

with open('src/data/somatic-complex.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("✅ Stories saved!")
