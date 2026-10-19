// Сгенерировано tools/build_and_test.py
const TASKS = [
 {
  "id": 1,
  "title": "Привет, мир",
  "desc": "Выведите строку <code>Привет, мир!</code>",
  "starter": "# ваш код\n",
  "tests": "assert OUT.strip()=='Привет, мир!', 'Ожидалось: Привет, мир!'"
 },
 {
  "id": 2,
  "title": "Переменные",
  "desc": "Создайте переменные <code>a = 7</code> и <code>b = 5</code> и выведите их сумму.",
  "starter": "a = \nb = \n",
  "tests": "assert a==7 and b==5\nassert OUT.strip()=='12'"
 },
 {
  "id": 3,
  "title": "Квадрат",
  "desc": "Напишите функцию <code>square(x)</code>, возвращающую квадрат числа.",
  "starter": "def square(x):\n    pass\n",
  "tests": "assert square(3)==9 and square(-4)==16 and square(0)==0"
 },
 {
  "id": 4,
  "title": "Чётность",
  "desc": "Функция <code>is_even(n)</code> возвращает <code>True</code>, если n чётное.",
  "starter": "def is_even(n):\n    pass\n",
  "tests": "assert is_even(4) is True and is_even(7) is False and is_even(0) is True"
 },
 {
  "id": 5,
  "title": "Максимум из двух",
  "desc": "Функция <code>max2(a, b)</code> возвращает большее число (без max()).",
  "starter": "def max2(a, b):\n    pass\n",
  "tests": "assert max2(3,5)==5 and max2(9,2)==9 and max2(-1,-1)==-1"
 },
 {
  "id": 6,
  "title": "Знак числа",
  "desc": "Функция <code>sign(n)</code> возвращает строку 'положительное', 'отрицательное' или 'ноль'.",
  "starter": "def sign(n):\n    pass\n",
  "tests": "assert sign(5)=='положительное' and sign(-2)=='отрицательное' and sign(0)=='ноль'"
 },
 {
  "id": 7,
  "title": "Числа от 1 до 5",
  "desc": "С помощью цикла выведите числа от 1 до 5, каждое с новой строки.",
  "starter": "for i in ...:\n    print(i)\n",
  "tests": "assert OUT.split()==['1','2','3','4','5']"
 },
 {
  "id": 8,
  "title": "Сумма до N",
  "desc": "Функция <code>sum_to(n)</code> возвращает сумму 1+2+...+n.",
  "starter": "def sum_to(n):\n    pass\n",
  "tests": "assert sum_to(1)==1 and sum_to(10)==55 and sum_to(0)==0"
 },
 {
  "id": 9,
  "title": "Факториал",
  "desc": "Функция <code>factorial(n)</code> возвращает n! (0! = 1).",
  "starter": "def factorial(n):\n    pass\n",
  "tests": "assert factorial(0)==1 and factorial(5)==120 and factorial(1)==1"
 },
 {
  "id": 10,
  "title": "Таблица умножения",
  "desc": "Выведите таблицу умножения на 3 от 1 до 5 в формате <code>3 x 1 = 3</code>.",
  "starter": "",
  "tests": "assert [l.strip() for l in OUT.strip().splitlines()]==[f'3 x {i} = {3*i}' for i in range(1,6)]"
 },
 {
  "id": 11,
  "title": "Сумма списка",
  "desc": "Функция <code>list_sum(lst)</code> возвращает сумму элементов списка (без sum()).",
  "starter": "def list_sum(lst):\n    pass\n",
  "tests": "assert list_sum([1,2,3])==6 and list_sum([])==0 and list_sum([-1,1])==0"
 },
 {
  "id": 12,
  "title": "Чётные элементы",
  "desc": "Функция <code>evens(lst)</code> возвращает новый список только из чётных чисел.",
  "starter": "def evens(lst):\n    pass\n",
  "tests": "assert evens([1,2,3,4,6])==[2,4,6] and evens([1,3])==[]"
 },
 {
  "id": 13,
  "title": "Минимум списка",
  "desc": "Функция <code>my_min(lst)</code> возвращает минимальный элемент (без min()).",
  "starter": "def my_min(lst):\n    pass\n",
  "tests": "assert my_min([3,1,2])==1 and my_min([5])==5 and my_min([-2,-9,0])==-9"
 },
 {
  "id": 14,
  "title": "Переворот строки",
  "desc": "Функция <code>reverse(s)</code> возвращает строку задом наперёд.",
  "starter": "def reverse(s):\n    pass\n",
  "tests": "assert reverse('abc')=='cba' and reverse('')=='' and reverse('Привет')=='тевирП'"
 },
 {
  "id": 15,
  "title": "Подсчёт гласных",
  "desc": "Функция <code>count_vowels(s)</code> считает гласные латинские буквы aeiou (без учёта регистра).",
  "starter": "def count_vowels(s):\n    pass\n",
  "tests": "assert count_vowels('Hello')==2 and count_vowels('xyz')==0 and count_vowels('AEIOU')==5"
 },
 {
  "id": 16,
  "title": "Палиндром",
  "desc": "Функция <code>is_palindrome(s)</code> возвращает True, если строка читается одинаково в обе стороны (без учёта регистра).",
  "starter": "def is_palindrome(s):\n    pass\n",
  "tests": "assert is_palindrome('Шалаш') and not is_palindrome('python') and is_palindrome('a')"
 },
 {
  "id": 17,
  "title": "Количество слов",
  "desc": "Функция <code>word_count(s)</code> возвращает число слов в строке (слова разделены пробелами).",
  "starter": "def word_count(s):\n    pass\n",
  "tests": "assert word_count('я люблю python')==3 and word_count('')==0 and word_count('  a  b ')==2"
 },
 {
  "id": 18,
  "title": "Частота букв",
  "desc": "Функция <code>char_freq(s)</code> возвращает словарь {символ: количество}.",
  "starter": "def char_freq(s):\n    pass\n",
  "tests": "assert char_freq('abca')=={'a':2,'b':1,'c':1} and char_freq('')=={}"
 },
 {
  "id": 19,
  "title": "Оценки",
  "desc": "Дан словарь оценок. Функция <code>best_student(d)</code> возвращает имя с наибольшей оценкой.",
  "starter": "def best_student(d):\n    pass\n",
  "tests": "assert best_student({'Аня':5,'Петя':3,'Оля':4})=='Аня' and best_student({'X':1})=='X'"
 },
 {
  "id": 20,
  "title": "FizzBuzz",
  "desc": "Функция <code>fizzbuzz(n)</code> возвращает 'FizzBuzz' если n делится на 15, 'Fizz' — на 3, 'Buzz' — на 5, иначе str(n).",
  "starter": "def fizzbuzz(n):\n    pass\n",
  "tests": "assert [fizzbuzz(i) for i in (1,3,5,15,7)]==['1','Fizz','Buzz','FizzBuzz','7']"
 }
];
