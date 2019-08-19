#include <hbclass.ch>

class ClassTest
   DATA nFormat AS NUMERIC INIT 0
   DATA nWidth AS NUMERIC INIT 100
   DATA cText AS CHARACTER INIT "Colonna"
   DATA nIndex 
   DATA nOrder 
   DATA nWidthMin 
   
   METHOD Test() //Directly C Code
   METHOD AddText()
endclass

METHOD AddText() CLASS ClassTest
   ::cText += " - Added from Harbour code"
return nil

procedure main()
   local col0 := ClassTest():New()
   local col1 := ClassTest():New()
   col1:cText := "Perry"
   col1:nWidthMin := 50
   
   col0:Test()
   CallMember(col1)
   col1:Test()
   col0 := GetNewCol()
   col0:Test()   
return

#pragma BEGINDUMP
#include <hbapi.h>
#include <hbapicls.h>
#include <hbapiitm.h>
#include <stdio.h>
#if _STACK
#include <hbstack.h>
#endif
// this code explain how to
// code a harbour's class with c code 

#define CLASSNAME "CLASSTEST"
struct CLASSTESTDATA
{
   HB_USHORT classId;
   
   HB_SIZE nFormat;
   HB_SIZE nWidth;
   HB_SIZE cText;
   HB_SIZE nIndex;
   HB_SIZE nOrder;
   HB_SIZE nWidthMin;
   PHB_SYMB Test;
} ClassTestData = {0};

void Init_ClassTest() { int i=0;
   if(ClassTestData.classId == 0)
   {
      ClassTestData.classId   = hb_clsFindClass(CLASSNAME, NULL);
      ClassTestData.cText     = hb_clsGetVarIndex(ClassTestData.classId,hb_dynsymGet("cText"));
      ClassTestData.nFormat   = hb_clsGetVarIndex(ClassTestData.classId,hb_dynsymGet("nFormat"));
      ClassTestData.nWidth    = hb_clsGetVarIndex(ClassTestData.classId,hb_dynsymGet("nWidth"));  
      ClassTestData.nIndex    = hb_clsGetVarIndex(ClassTestData.classId,hb_dynsymGet("nIndex"));
      ClassTestData.nOrder    = hb_clsGetVarIndex(ClassTestData.classId,hb_dynsymGet("nOrder"));
      ClassTestData.nWidthMin = hb_clsGetVarIndex(ClassTestData.classId,hb_dynsymGet("nWidthMin"));
   }
}

HB_FUNC( CALLMEMBER )
{
   PHB_ITEM pItem = hb_param(1, HB_IT_OBJECT );
   hb_objSendMsg(pItem,"AddText",0);   
   hb_ret();
}

HB_FUNC( GETNEWCOL  ) 
{
   PHB_ITEM pItem = hb_itemNew(NULL);
   Init_ClassTest();
   hb_clsAssociate( ClassTestData.classId );
   pItem = hb_stackReturnItem();
   hb_itemArrayPut(pItem,ClassTestData.cText, hb_itemPutC(NULL,"From C code"));
   hb_itemArrayPut(pItem,ClassTestData.nWidthMin, hb_itemPutNI(NULL, 611));
}

HB_FUNC( CLASSTEST_TEST  ) 
{
   PHB_ITEM pItem = hb_stackSelfItem();
   PHB_ITEM data;
   Init_ClassTest();
   
   if(pItem==0 || hb_objGetClass(pItem)!=ClassTestData.classId)
   {
            if(pItem==0) printf("no self\r\n");
      else  if(hb_objGetClass(pItem)!=ClassTestData.classId) printf("self is not a \"" CLASSNAME "\" (it is %i)\r\n", hb_objGetClass(pItem)); 
      return; //invalid input
   }
      
   data = hb_itemArrayGet(pItem,ClassTestData.cText); 
   printf("Column \"%s\"",hb_itemGetC(data));
   data = hb_itemArrayGet(pItem,ClassTestData.nFormat);
   if(!HB_IS_NIL(data)) printf(" format:%i",hb_itemGetNI(data));
   data = hb_itemArrayGet(pItem,ClassTestData.nIndex);
   if(!HB_IS_NIL(data)) printf(" index:%i",hb_itemGetNI(data));
   data = hb_itemArrayGet(pItem,ClassTestData.nOrder);
   if(!HB_IS_NIL(data)) printf(" order:%i",hb_itemGetNI(data));
   data = hb_itemArrayGet(pItem,ClassTestData.nWidth);
   if(!HB_IS_NIL(data)) printf(" width %i",hb_itemGetNI(data));
   data = hb_itemArrayGet(pItem,ClassTestData.nWidthMin);
   if(!HB_IS_NIL(data)) printf(" min %i",hb_itemGetNI(data));
   printf("\r\n");   
   hb_ret();
}

#pragma ENDDUMP
