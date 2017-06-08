// hbmk2 builds -gtcgi

#define CRLF chr(13)+chr(10)
/*
//		'#include "err.prg"' + CRLF + ;
		"static superman, batman" + CRLF + ;

		"memvar arrow, flash" + CRLF + ;
		"" + CRLF + ;
		"class oggetto" + CRLF + ;
		"   DATA soo AS STRING" + CRLF + ;
		"   DATA noo AS NUMERIC" + CRLF + ;
		"   DATA ioo" + CRLF + ;
		"   METHOD aBitmap( n )      INLINE ( If( empty(n) .or. (n > 0 .and. n <= 10), 5 , nil ) )" + CRLF + ;
		"   METHOD otherMedhod()"  + CRLF + ;
		"	METHOD oggProc()"  + CRLF + ;
		"endclass" + CRLF + ;
		"METHOD otherMedhod() CLASS oggetto" + CRLF + ;
		"return nil" + CRLF + ;
		"METHOD oggProc() class oggetto" + CRLF + ;
		"return" + CRLF + ;
*/
proc main()
	LOCAL cTest := ;
		"#include <hbclass.ch>" + CRLF + ;
		"" + CRLF + ;
		"proc test()" + CRLF + ;
		" LOCAL bTest := {|| pippo() }" + CRLF + ;
		" LOCAL i" + CRLF + ;
		" public arrow, flash" + CRLF + ;
		" private canary, firestorm" + CRLF + ;
		" j := 2" + CRLF + ;
		" test2('aa')" + CRLF + ;
		"return" + CRLF +;
		"" + CRLF + ;
		"func test2(pippo)" + CRLF + ;
		" FIELD a" + CRLF + ;
		" LOCAL i:= 1, j := 4, k:= 5" + CRLF + ;
		" memvar canary, firestorm" + CRLF + ;
		" i += 2" + CRLF + ;
		" ? i" + CRLF + ;
		"return pippo+1" 
	LOCAL aMsg, i
	//LOCAL procedureRegEx := 
	? test2(cTest, @aMsg)
	? valtype(aMsg), len(aMsg)
	for i:=1 to len(aMsg)
	    ? aMsg[i,1], aMsg[i,2], aMsg[i,3], aMsg[i,4], aMsg[i,5] 
	next
	callPP()
return

proc pippo_Pluto()
	LOCAL i:=4
	a := i!=4
	? "arrivano pippo e pluto"
	? i,j,;
		j,;
		i
return

#pragma BEGINDUMP
#include <hbapi.h>
#include <hbcomp.h>
#include <hbapiitm.h>


static int pOpenFunc( void * cargo, char * zFileName,
                          HB_BOOL fBefore, HB_BOOL fSysFile, HB_BOOL fBinary,
                          HB_PATHNAMES * pIncludePaths,
                          HB_BOOL * pfNested, FILE ** file_ptr,
                          const char ** pBufPtr, HB_SIZE * pnLen, HB_BOOL * pfFree )
{	
	HB_SYMBOL_UNUSED( cargo );
	HB_SYMBOL_UNUSED( pfNested );
	HB_SYMBOL_UNUSED( file_ptr );
	HB_SYMBOL_UNUSED( pBufPtr );
	HB_SYMBOL_UNUSED( pnLen );
	HB_SYMBOL_UNUSED( pfFree );
	
	HB_PATHNAMES* pInc = pIncludePaths;
	char *nameBuff;
	HB_SIZE nRead;
	int i;
	printf("open %s(%i,%i,%i):", zFileName,  fBefore, fSysFile, fBinary);
	//printf(szText,szPar1,szPar2);
	printf("\r\n");
	while(pInc)
	{
		printf("  %s(%i)\r\n",pInc->szPath,pInc->fFree);
		pInc = pInc->pNext;
	}
    nameBuff = (char*)hb_xalloc(35+strlen(zFileName));
    if(fBefore)
		strcpy(nameBuff,"c:\\harbour\\include\\"); // windows
	    //strcpy(nameBuff,"/home/perry/harbour-src/include/"); // linux
	else
		*nameBuff = 0;
    strcat(nameBuff,zFileName);

	*file_ptr = fopen(nameBuff,"rt");
	if(*file_ptr)
	{
		printf("opened %s (%08X)\r\n",nameBuff, file_ptr);
		fseek(*file_ptr,0,SEEK_END);
		*pnLen = ftell(*file_ptr);
		*pBufPtr = (char*)hb_xalloc(*pnLen+1);
		//fseek(*file_ptr,0,SEEK_SET);
		fclose(*file_ptr);
		*file_ptr = fopen(nameBuff,"rt");
		nRead = fread(&((*pBufPtr)[nRead]),1,*pnLen,*file_ptr);
		printf("readed %i/%i (%i)\r\n",nRead,*pnLen, ferror(*file_ptr));
		*pnLen = nRead;
		fclose(*file_ptr);
	    hb_xfree(nameBuff);	
		return HB_PP_OPEN_OK;
	}
    hb_xfree(nameBuff);	
	return HB_PP_OPEN_FILE;
}

static void pMsgFunc( void * cargo, int iErrorFmt, int iLine,
                      const char * szModule, char cPrefix, int iValue,
                      const char * szText,
                      const char * szPar1, const char * szPar2 )
{
    HB_SYMBOL_UNUSED( iErrorFmt );
    PHB_ITEM pMsgDest = (PHB_ITEM) ((PHB_COMP)cargo)->cargo;
    PHB_ITEM pMsgItem = hb_itemArrayNew(5);
    char szPrefix[2], *szMess, len;
    szPrefix[0] = cPrefix; szPrefix[1] = 0;
    hb_arraySetCConst(pMsgItem, 1, szPrefix);
    hb_arraySetNI(pMsgItem, 2, iValue);
    hb_arraySetCConst(pMsgItem, 3, szModule);
    hb_arraySetNI(pMsgItem, 4, iLine);
    len = strlen(szText);//sprintf(0, szText,szPar1,szPar2);
    if(szPar1) len += strlen(szPar1);
    if(szPar2) len += strlen(szPar2);
    szMess = (char*)hb_xalloc(len+1);
    //printf("msg %X (%i)\r\n", szMess, len);
    sprintf(szMess, szText,szPar1,szPar2);
    hb_arraySetC(pMsgItem, 5, szMess);
    hb_xfree(szMess);
    hb_arrayAdd(pMsgDest, pMsgItem);
}

static void hb_compInitVars( HB_COMP_DECL )
{
   HB_COMP_PARAM->functions.iCount = 0;
   HB_COMP_PARAM->functions.pFirst = NULL;
   HB_COMP_PARAM->functions.pLast  = NULL;
   HB_COMP_PARAM->szAnnounce       = NULL;
   HB_COMP_PARAM->fSwitchCase      = HB_FALSE;

   HB_COMP_PARAM->symbols.iCount   = 0;
   HB_COMP_PARAM->symbols.pFirst   = NULL;
   HB_COMP_PARAM->symbols.pLast    = NULL;
   HB_COMP_PARAM->pInitFunc        = NULL;
   HB_COMP_PARAM->pLineFunc        = NULL;
   HB_COMP_PARAM->pDeclFunc        = NULL;

   HB_COMP_PARAM->iStaticCnt       = 0;
   HB_COMP_PARAM->iVarScope        = HB_VSCOMP_LOCAL;

   HB_COMP_PARAM->inlines.iCount   = 0;
   HB_COMP_PARAM->inlines.pFirst   = NULL;
   HB_COMP_PARAM->inlines.pLast    = NULL;

   HB_COMP_PARAM->szFile           = NULL;

   HB_COMP_PARAM->iModulesCount    = 0;
}

HB_FUNC( TEST2 )
{
	const char * szSource = hb_parc( 1 );
	const char * szFileName = "perry.prg";
	PHB_ITEM pMsgDest = hb_param(2,HB_IT_BYREF );
	HB_COMP_DECL;
	int iStatus = 0;
	PHB_HFUNC pFunc;
	PHB_HVAR pVar;
	PHB_HCLASS pClasses;
	PHB_HDECLARED pDeclared;
	
	//printf("dest: %X\r\n",pMsgDest);
	
	HB_COMP_PARAM = hb_comp_new();
	if( pMsgDest )
	{
		HB_COMP_PARAM->cargo = pMsgDest;
		HB_COMP_PARAM->outMsgFunc = pMsgFunc;
		hb_arrayNew(pMsgDest,0);
	}
	HB_COMP_PARAM->iWarnings = 3;
	HB_COMP_PARAM->fDebugInfo = HB_FALSE;
	HB_COMP_PARAM->fLineNumbers = HB_TRUE;
	HB_COMP_PARAM->fGauge = HB_FALSE;

	hb_compChkEnvironment( HB_COMP_PARAM );
	HB_COMP_PARAM->iSyntaxCheckOnly = 1;
	hb_compInitPP( HB_COMP_PARAM, pOpenFunc );
	hb_compIdentifierOpen( HB_COMP_PARAM );

   hb_compInitVars( HB_COMP_PARAM );
	if( ! hb_pp_inBuffer( HB_COMP_PARAM->pLex->pPP, szFileName, szSource, strlen( szSource ), 0 ) )
	{
		hb_compOutErr( HB_COMP_PARAM, "Cannot create preprocessor buffer." );
		iStatus = EXIT_FAILURE;
		hb_comp_free( HB_COMP_PARAM );
		return;
	}
	HB_COMP_PARAM->iModulesCount = 1;
	HB_COMP_PARAM->currLine = hb_pp_line( HB_COMP_PARAM->pLex->pPP ) + 1;
	HB_COMP_PARAM->currModule = hb_compIdentifierNew(
		HB_COMP_PARAM, szFileName, HB_IDENT_COPY );

	hb_comp_yyparse( HB_COMP_PARAM );

	printf(" ****  \r\n");
	pFunc = HB_COMP_PARAM->functions.pFirst;
	while( pFunc)
	{
	//	if( ( pFunc->funFlags & HB_FUNF_FILE_DECL ) == 0 )
		{
			//hb_compOptimizeFrames( HB_COMP_PARAM, pFunc );
		#ifdef _USE_MYHB
			printf("%s (%i) - %X\r\n",pFunc->szName,pFunc->iDeclLine, pFunc->funFlags);
		#else
			printf("%s - %X\r\n",pFunc->szName, pFunc->funFlags);
		#endif
			pVar = pFunc->pLocals;
			while(pVar)
			{
			#ifdef _USE_MYHB
				printf("L-->%s (at %i(%i:%i))\r\n",pVar->szName,pVar->iDeclLine,pVar->iStartCol,pVar->iEndCol);
			#else
				printf("L-->%s (at %i)\r\n",pVar->szName,pVar->iDeclLine);
			#endif
				pVar = pVar->pNext;
			}
			pVar = pFunc->pStatics;
			while(pVar)
			{
			#ifdef _USE_MYHB
				printf("L-->%s (at %i(%i:%i))\r\n",pVar->szName,pVar->iDeclLine,pVar->iStartCol,pVar->iEndCol);
			#else
				printf("L-->%s (at %i)\r\n",pVar->szName,pVar->iDeclLine);
			#endif
				pVar = pVar->pNext;
			}
			pVar = pFunc->pFields;
			while(pVar)
			{
			#ifdef _USE_MYHB
				printf("L-->%s (at %i(%i:%i))\r\n",pVar->szName,pVar->iDeclLine,pVar->iStartCol,pVar->iEndCol);
			#else
				printf("L-->%s (at %i)\r\n",pVar->szName,pVar->iDeclLine);
			#endif
				pVar = pVar->pNext;
			}
			pVar = pFunc->pMemvars;
			while(pVar)
			{
			#ifdef _USE_MYHB
				printf("L-->%s (at %i(%i:%i))\r\n",pVar->szName,pVar->iDeclLine,pVar->iStartCol,pVar->iEndCol);
			#else
				printf("L-->%s (at %i)\r\n",pVar->szName,pVar->iDeclLine);
			#endif
				pVar = pVar->pNext;
			}
			pFunc = pFunc->pNext;
		}
	}
//*
	pClasses = HB_COMP_PARAM->pFirstClass;
	while(pClasses)
	{
	#ifdef _USE_MYHB
		printf("class: %s(%i)\r\n", pClasses->szName, pClasses->iDeclLine);
	#else
		printf("class: %s\r\n", pClasses->szName);
	#endif
		// here I can search for declared function with same name and change it type in class
		pDeclared = pClasses->pMethod;
		while(pDeclared)
		{
			// here I can search for declared function with className_DeclaredName and change it type in method
			// 
		#ifdef _USE_MYHB
			printf("--> %s (%i) >'%c' - %i\r\n", pDeclared->szName,pDeclared->iDeclLine, pDeclared->cType, pDeclared->iParamCount);
		#else
			printf("--> %s >'%c' - %i\r\n", pDeclared->szName, pDeclared->cType, pDeclared->iParamCount);
		#endif
			pDeclared = pDeclared->pNext;
		}
		pClasses = pClasses->pNext;
	}
	pDeclared = HB_COMP_PARAM->pFirstDeclared;
	while(pDeclared)
	{
		#ifdef _USE_MYHB
			printf("--> %s (%i) >'%c' - %i\r\n", pDeclared->szName,pDeclared->iDeclLine, pDeclared->cType, pDeclared->iParamCount);
		#else
			printf("--> %s >'%c' - %i\r\n", pDeclared->szName, pDeclared->cType, pDeclared->iParamCount);
		#endif
		pDeclared = pDeclared->pNext;
	}
//*/
	hb_comp_free(HB_COMP_PARAM);
	hb_retni(iStatus);
}

HB_FUNC( TEST )
{
   const char * szSource = hb_parc( 1 );
   int argc = 0, i;
   const char ** argv= 0;
   int iResult;
   HB_BYTE * pBuffer;
   HB_SIZE nLen;
   PHB_ITEM pParam = hb_param( 2, HB_IT_ARRAY );
   if( pParam )
   {
      argc = hb_arrayLen( pParam );
      argv = ( const char ** ) hb_xgrab( sizeof( char * ) * ( argc + 1 ) );
      for( i = 1; i <= argc; ++i )
      {
         argv[ i-1 ] = hb_arrayGetCPtr( pParam, i );
      }
   }
   printf("call\r\n");
   iResult = hb_compMainExt( argc, argv, &pBuffer, &nLen, szSource, 0, 0, 0, pMsgFunc );
   //hb_compCompile( pComp, "{SOURCE}", szSource, iStartLine );
   printf("%i\r\n",iResult);
   if( iResult == EXIT_SUCCESS && pBuffer )
      hb_retclen_buffer( ( char * ) pBuffer, nLen );
}

HB_FUNC( CALLPP )
{
	PHB_DYNS pDyns = hb_dynsymFind( "PIPPO_PLUTO" );
	if( pDyns && ! hb_dynsymIsFunction( pDyns ) )
         pDyns = NULL;
    if( pDyns )
    {
		hb_vmPushDynSym( pDyns );
      	hb_vmPushNil();
      	// push other params
		hb_vmDo( 0 ); //<-- nParams
	}
}

#pragma ENDDUMP

