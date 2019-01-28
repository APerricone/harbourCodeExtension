# Prologo
Il deubbger si mette in ascolto sulla porta 6110, quindi lancia il programma, al primo client che si collega smette di ascoltare e gestisce questo come il programma da debuggare.
a questo punto cominciano a scambiarsi pacchetti, essi hanno forma asimettrica, *da cambiare*.
Quelli dal -> debugger verso il programma hanno forma COMANDO:PARAM1:PARAM2:PARAM3...\r\n.
Quelli dal <- programma verso il debugger hanno forma COMANDO\r\nPARAM1\r\nPARAM2\r\n.

## GO ->
Indica al programma di proseguire l'esecuzione

## NEXT ->
Indica al programma di eseguire la prossima istruzione

## STEP ->
Indica al programma di eseguire la prossima istruzione allo stesso livello

## EXIT ->
Indica al programma di uscire dal metoo corrente

## PAUSE ->
Indica al programma di interrompere l'esecuzione alla prima istruzione ***compilata con i simboli di debug***.

## STOP <-
Indica che il programma si è interrotto. è seguito da una descrizione testuale del perché si è fermato, ad esempio "Break" perché ha trovato un breakpoint, "Pause" perche é stato procesato il comando PAUSE,  ecc...

## ERROR <-
Indica che il programma si è interrotto a seguito di un'errore

## INERROR ->
Chiede se si è in errore, il programma restituisce T se si è in errore. ***Inutile***

## BREAKPOINT ->
Indica che sto per inviare un break point. la seconda riga ha l'elenco dei parametri separati da : due punti.
 * \+ per i breapoint da aggiungere, - per quelli da togliere
 * il nome del file
 * la riga
 * opzionalmente ? seguito da (separato da due punti) un comando in harbour da esegure dove i : sono sostituiti da ;. Il breakpoint scatta solo se la condizione è vera.
 * opzionalmente C seguito da (separato da due punti) un numero ad indicare dopo quante volte il breakpoint scatterà
 * opzionalmente L seguito da (separato da due punti) una stringa dove le parte tra parentesi graffe vengono eseguite (***da cambiare***)

## LOG <-
Richiede la stampa di una stringa di debug, che seguie il "LOG:"

## LOCALS, PUBLICS, PRIVATES, PRIVATE_CALLEE, STATICS ->
Richede la lista delle variabili nello scopo indicato dal comando. la seconda riga ha l'elenco dei parametri separati da : due punti.
 * il livello dello stack
 * l'indice del primo elemento da tornare, partendo da 1
 * il numero di element da tornare, 0 per averli tutti.
il programma risponderò con un messaggio che comincia con lo stesso comando, seguito da le informazioni separate da 2 punti:
 * la prima parte del comando per avere i figli di questa variabile, 3 lettere
 * il libello dello stack
 * l'id di questa variabile (numerico)
 * il nome dell'id di questa variabile 
 * il nome 

## EXPRESSION ->
Richiede l'esecuzione di un comando. la seconda riga ha l'elenco dei parametri separati da : due punti.
 * il livello nello stack
 * l'espressione dove i : sono stituiti da ;
Per ognuno di questi comandi il debugger risponderà con un messaggio che comincia con **EXPRESSION** seguito da le informazioni separate da 2 punti:
 * il livello dello stack
 * il tipo del risultato, può valere U, N, C, L, A, H, O ecc..
 * il risultato da mostrare, nel caso di N,C,L oppure il numero di figli nel caso A,H,O

